import * as test from "bun:test"
import * as Effect from "effect/Effect"
import * as Either from "effect/Either"
import * as Layer from "effect/Layer"
import * as Schedule from "effect/Schedule"
import * as ManagedRuntime from "effect/ManagedRuntime"
import { BunChildProcessSpawner } from "effect-start/bun"
import * as Docker from "effect-start/Docker"
import * as System from "effect-start/System"
import { SqlClient } from "effect-start/sql"
import * as BunSql from "../../../src/sql/bun/index.ts"

const PASSWORD = "test"

const SqlLayer = (() => {
  const container = Effect.map(System.randomFreePort, (port) =>
    Docker.layerContainer({
      image: "postgres:17-alpine",
      detach: true,
      env: { POSTGRES_PASSWORD: PASSWORD, POSTGRES_DB: "test" },
      ports: [[port, 5432]],
    }),
  ).pipe(Layer.unwrapEffect, Layer.provideMerge(Docker.layer))

  const ready = Layer.effectDiscard(
    Effect.flatMap(Docker.DockerContainer, (c) =>
      c.exec(["psql", "-U", "postgres", "-d", "test", "-c", "SELECT 1"]).pipe(
        Effect.filterOrFail((r) => r.exitCode === 0),
        Effect.retry(Schedule.spaced("500 millis")),
        Effect.timeoutFail({
          duration: "30 seconds",
          onTimeout: () => new Docker.DockerError({ message: "Timed out waiting for PostgreSQL" }),
        }),
        Effect.asVoid,
      ),
    ),
  ).pipe(Layer.provide(container))

  return Effect.map(Docker.DockerContainer, (c) => {
    const port = c.ports?.[0]?.[0]
    if (!port) throw new Error("No port mapping found")
    return BunSql.layer({
      url: `postgres://postgres:${PASSWORD}@localhost:${port}/test`,
    })
  }).pipe(Layer.unwrapEffect, Layer.provide(Layer.merge(container, ready)))
})()

const runtime = ManagedRuntime.make(SqlLayer.pipe(Layer.provide(BunChildProcessSpawner.layer)))

const runSql = <A, E>(effect: Effect.Effect<A, E, SqlClient.SqlClient>) =>
  runtime.runPromise(effect)

test.describe.skipIf(!process.env.TEST_SQL)("BunSql (postgres)", () => {
  test.beforeAll(() => runtime.runPromise(Effect.void), 120_000)

  test.afterAll(() => runtime.dispose())

  test.describe("unsafe queries", () => {
    test.it("should execute unsafe with $N parameter placeholders", () =>
      runSql(
        Effect.gen(function* () {
          const sql = yield* SqlClient.SqlClient
          yield* sql.unsafe("DROP TABLE IF EXISTS unsafe_params")
          yield* sql.unsafe(
            "CREATE TABLE unsafe_params (id SERIAL PRIMARY KEY, name TEXT, age INT)",
          )
          yield* sql.unsafe("INSERT INTO unsafe_params (name, age) VALUES ($1, $2)", ["Alice", 30])
          const rows = yield* sql.unsafe<{ name: string; age: number }>(
            "SELECT name, age FROM unsafe_params WHERE age > $1",
            [20],
          )

          test.expect(rows).toHaveLength(1)
          test.expect(rows[0]).toEqual({ name: "Alice", age: 30 })

          yield* sql.unsafe("DROP TABLE unsafe_params")
        }),
      ),
    )
  })

  test.describe("notify", () => {
    test.it("should send NOTIFY via unsafe", () =>
      runSql(
        Effect.gen(function* () {
          const sql = yield* SqlClient.SqlClient
          yield* sql.unsafe("NOTIFY test_chan, 'hello'")
        }),
      ),
    )

    test.it("should send NOTIFY via pg_notify", () =>
      runSql(
        Effect.gen(function* () {
          const sql = yield* SqlClient.SqlClient
          const rows = yield* sql`SELECT pg_notify(${"test_chan"}, ${"payload"})`

          test.expect(rows).toHaveLength(1)
        }),
      ),
    )

    test.it("should send NOTIFY inside a transaction", () =>
      runSql(
        Effect.gen(function* () {
          const sql = yield* SqlClient.SqlClient
          yield* sql.withTransaction(
            Effect.gen(function* () {
              yield* sql.unsafe("NOTIFY tx_chan, 'from_tx'")
              yield* sql`SELECT pg_notify(${"tx_chan"}, ${"from_tx2"})`
            }),
          )
        }),
      ),
    )
  })

  test.describe("reserve", () => {
    test.it("should run queries on a reserved connection", () =>
      runSql(
        Effect.gen(function* () {
          const sql = yield* SqlClient.SqlClient
          const reserved = yield* sql.reserve
          yield* reserved.unsafe("DROP TABLE IF EXISTS reserve_test")
          yield* reserved.unsafe("CREATE TABLE reserve_test (id SERIAL PRIMARY KEY, name TEXT)")
          yield* reserved.unsafe("INSERT INTO reserve_test (name) VALUES ('reserved')")
          const rows = yield* reserved<{ name: string }>`SELECT name FROM reserve_test`

          test.expect(rows).toHaveLength(1)
          test.expect(rows[0].name).toBe("reserved")

          yield* reserved.unsafe("DROP TABLE reserve_test")
        }).pipe(Effect.scoped),
      ),
    )

    test.it("should isolate reserved connection from pool", () =>
      runSql(
        Effect.gen(function* () {
          const sql = yield* SqlClient.SqlClient
          const reserved = yield* sql.reserve
          yield* reserved.unsafe("DROP TABLE IF EXISTS reserve_iso")
          yield* reserved.unsafe("CREATE TABLE reserve_iso (id SERIAL PRIMARY KEY, val INT)")
          yield* reserved.unsafe("BEGIN")
          yield* reserved.unsafe("INSERT INTO reserve_iso (val) VALUES (1)")
          const poolRows = yield* sql`SELECT * FROM reserve_iso`

          test.expect(poolRows).toHaveLength(0)

          yield* reserved.unsafe("COMMIT")
          const afterRows = yield* sql`SELECT * FROM reserve_iso`

          test.expect(afterRows).toHaveLength(1)

          yield* reserved.unsafe("DROP TABLE reserve_iso")
        }).pipe(Effect.scoped),
      ),
    )
  })

  test.describe("fragments", () => {
    test.it("should interpolate identifier, list, and values fragments", () =>
      runSql(
        Effect.gen(function* () {
          const sql = yield* SqlClient.SqlClient
          yield* sql`DROP TABLE IF EXISTS frag_test`
          yield* sql`CREATE TABLE frag_test (id SERIAL PRIMARY KEY, name TEXT, age INTEGER)`
          yield* sql`INSERT INTO frag_test ${sql([
            { name: "Alice", age: 25 },
            { name: "Bob", age: 30 },
          ])}`

          const table = sql("frag_test")
          const rows = yield* sql<{
            name: string
          }>`SELECT name FROM ${table} WHERE name IN ${sql(["Alice"])} ORDER BY name`
          test.expect(rows).toEqual([{ name: "Alice" }])

          yield* sql`DROP TABLE frag_test`
        }),
      ),
    )
  })

  test.describe("use", () => {
    test.it("should run native begin transaction via driver", () =>
      runSql(
        Effect.gen(function* () {
          const sql = yield* SqlClient.SqlClient
          yield* sql`DROP TABLE IF EXISTS use_tx`
          yield* sql`CREATE TABLE use_tx (id SERIAL PRIMARY KEY, name TEXT)`
          yield* sql.use((bunSql) =>
            bunSql.begin((tx: any) => tx`INSERT INTO use_tx (name) VALUES (${"from_use"})`),
          )
          const rows = yield* sql<{ name: string }>`SELECT name FROM use_tx`

          test.expect(rows).toHaveLength(1)
          test.expect(rows[0].name).toBe("from_use")

          yield* sql`DROP TABLE use_tx`
        }),
      ),
    )
  })

  test.describe("error handling", () => {
    test.it("should produce SqlError with code for invalid queries", () =>
      runSql(
        Effect.gen(function* () {
          const sql = yield* SqlClient.SqlClient
          const result = yield* sql`SELECT * FROM nonexistent_table_xyz`.pipe(Effect.either)

          test.expect(Either.isLeft(result)).toBe(true)

          if (Either.isLeft(result)) {
            test.expect(result.left._tag).toBe("SqlError")
            test.expect(result.left.code).toBe("42P01")
          }
        }),
      ),
    )

    test.it("should produce SqlError with code for constraint violations", () =>
      runSql(
        Effect.gen(function* () {
          const sql = yield* SqlClient.SqlClient
          yield* sql`DROP TABLE IF EXISTS unique_test`
          yield* sql`CREATE TABLE unique_test (id SERIAL PRIMARY KEY, email TEXT UNIQUE)`
          yield* sql`INSERT INTO unique_test (email) VALUES (${"a@b.com"})`
          const result = yield* sql`INSERT INTO unique_test (email) VALUES (${"a@b.com"})`.pipe(
            Effect.either,
          )

          test.expect(Either.isLeft(result)).toBe(true)

          if (Either.isLeft(result)) {
            test.expect(result.left._tag).toBe("SqlError")
            test.expect(result.left.code).toBe("23505")
          }

          yield* sql`DROP TABLE unique_test`
        }),
      ),
    )
  })

  test.describe("multiple data types", () => {
    test.it("should handle Postgres-specific types", () =>
      runSql(
        Effect.gen(function* () {
          const sql = yield* SqlClient.SqlClient
          yield* sql`DROP TABLE IF EXISTS pg_types`
          yield* sql`CREATE TABLE pg_types (
            bool_val BOOLEAN,
            real_val DOUBLE PRECISION
          )`
          yield* sql`INSERT INTO pg_types VALUES (${true}, ${3.14})`
          const rows = yield* sql<{
            bool_val: boolean
            real_val: number
          }>`SELECT * FROM pg_types`

          test.expect(rows).toHaveLength(1)
          test.expect(rows[0].bool_val).toBe(true)
          test.expect(rows[0].real_val).toBeCloseTo(3.14)

          yield* sql`DROP TABLE pg_types`
        }),
      ),
    )
  })
})
