import * as test from "bun:test"
import * as Chunk from "effect/Chunk"
import * as Effect from "effect/Effect"
import * as Either from "effect/Either"
import * as Fiber from "effect/Fiber"
import * as ManagedRuntime from "effect/ManagedRuntime"
import * as PubSub from "effect/PubSub"
import * as Runtime from "effect/Runtime"
import * as Stream from "effect/Stream"
import * as Sql from "../../Sql.ts"
import * as PgSql from "./index.ts"
import * as PgDocker from "./docker.ts"

const PgLayer = PgSql.layer({
  host: "localhost",
  port: 5433,
  user: "postgres",
  password: "test",
  database: "test",
})

const runtime = ManagedRuntime.make(PgLayer)

const runSql = <A, E>(effect: Effect.Effect<A, E, Sql.SqlClient>) => runtime.runPromise(effect)

test.describe.skipIf(!process.env.TEST_SQL)("PgSql", () => {
  test.beforeAll(() => PgDocker.start(), 60_000)

  test.afterAll(async () => {
    await runtime.dispose()
    await PgDocker.stop()
  })

  test.describe("basic queries", () => {
    test.it("should create table and insert rows", () =>
      runSql(
        Effect.gen(function* () {
          const sql = yield* Sql.SqlClient
          yield* sql`DROP TABLE IF EXISTS users`
          yield* sql`CREATE TABLE users (id SERIAL PRIMARY KEY, name TEXT)`
          yield* sql`INSERT INTO users (name) VALUES (${"Alice"})`
          yield* sql`INSERT INTO users (name) VALUES (${"Bob"})`
          const rows = yield* sql<{ id: number; name: string }>`SELECT * FROM users ORDER BY id`

          test.expect(rows).toHaveLength(2)
          test.expect(rows[0]).toMatchObject({ name: "Alice" })
          test.expect(rows[1]).toMatchObject({ name: "Bob" })

          yield* sql`DROP TABLE users`
        }),
      ),
    )

    test.it("should return empty array for no results", () =>
      runSql(
        Effect.gen(function* () {
          const sql = yield* Sql.SqlClient
          yield* sql`DROP TABLE IF EXISTS empty_test`
          yield* sql`CREATE TABLE empty_test (id SERIAL PRIMARY KEY)`
          const rows = yield* sql`SELECT * FROM empty_test`

          test.expect(rows).toHaveLength(0)

          yield* sql`DROP TABLE empty_test`
        }),
      ),
    )

    test.it("should handle parameterized queries", () =>
      runSql(
        Effect.gen(function* () {
          const sql = yield* Sql.SqlClient
          yield* sql`DROP TABLE IF EXISTS params`
          yield* sql`CREATE TABLE params (id SERIAL PRIMARY KEY, value TEXT, count INTEGER)`
          yield* sql`INSERT INTO params (value, count) VALUES (${"hello"}, ${42})`
          const rows = yield* sql<{
            value: string
            count: number
          }>`SELECT value, count FROM params WHERE count > ${10}`

          test.expect(rows).toHaveLength(1)
          test.expect(rows[0]).toEqual({ value: "hello", count: 42 })

          yield* sql`DROP TABLE params`
        }),
      ),
    )
  })

  test.describe("unsafe queries", () => {
    test.it("should execute raw SQL strings", () =>
      runSql(
        Effect.gen(function* () {
          const sql = yield* Sql.SqlClient
          yield* sql.unsafe("DROP TABLE IF EXISTS raw_test")
          yield* sql.unsafe("CREATE TABLE raw_test (id SERIAL PRIMARY KEY, name TEXT)")
          yield* sql.unsafe("INSERT INTO raw_test (name) VALUES ('test')")
          const rows = yield* sql.unsafe<{ id: number; name: string }>("SELECT * FROM raw_test")

          test.expect(rows).toHaveLength(1)
          test.expect(rows[0]).toMatchObject({ name: "test" })

          yield* sql.unsafe("DROP TABLE raw_test")
        }),
      ),
    )

    test.it("should execute unsafe with parameter values", () =>
      runSql(
        Effect.gen(function* () {
          const sql = yield* Sql.SqlClient
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

    test.it("should execute unsafe inside a transaction", () =>
      runSql(
        Effect.gen(function* () {
          const sql = yield* Sql.SqlClient
          yield* sql.unsafe("DROP TABLE IF EXISTS unsafe_tx")
          yield* sql.unsafe("CREATE TABLE unsafe_tx (id SERIAL PRIMARY KEY, name TEXT)")

          yield* sql.withTransaction(
            Effect.gen(function* () {
              yield* sql.unsafe("INSERT INTO unsafe_tx (name) VALUES ('from_unsafe')")
              const rows = yield* sql.unsafe<{ name: string }>("SELECT name FROM unsafe_tx")

              test.expect(rows).toHaveLength(1)
              test.expect(rows[0].name).toBe("from_unsafe")
            }),
          )

          const rows = yield* sql`SELECT * FROM unsafe_tx`

          test.expect(rows).toHaveLength(1)

          yield* sql.unsafe("DROP TABLE unsafe_tx")
        }),
      ),
    )
  })

  test.describe("transactions", () => {
    test.it("should commit on success", () =>
      runSql(
        Effect.gen(function* () {
          const sql = yield* Sql.SqlClient
          yield* sql`DROP TABLE IF EXISTS tx_test`
          yield* sql`CREATE TABLE tx_test (id SERIAL PRIMARY KEY, name TEXT)`
          yield* sql.withTransaction(sql`INSERT INTO tx_test (name) VALUES (${"in_tx"})`)
          const rows = yield* sql`SELECT * FROM tx_test`

          test.expect(rows).toHaveLength(1)

          yield* sql`DROP TABLE tx_test`
        }),
      ),
    )

    test.it("should rollback on failure", () =>
      runSql(
        Effect.gen(function* () {
          const sql = yield* Sql.SqlClient
          yield* sql`DROP TABLE IF EXISTS tx_rollback`
          yield* sql`CREATE TABLE tx_rollback (id SERIAL PRIMARY KEY, name TEXT)`
          yield* sql`INSERT INTO tx_rollback (name) VALUES (${"before"})`

          const result = yield* sql
            .withTransaction(
              Effect.gen(function* () {
                yield* sql`INSERT INTO tx_rollback (name) VALUES (${"should_rollback"})`
                return yield* Effect.fail(
                  new Sql.SqlError({ code: "TEST", message: "intentional" }),
                )
              }),
            )
            .pipe(Effect.either)

          test.expect(Either.isLeft(result)).toBe(true)

          const rows = yield* sql<{ name: string }>`SELECT * FROM tx_rollback`

          test.expect(rows).toHaveLength(1)
          test.expect(rows[0].name).toBe("before")

          yield* sql`DROP TABLE tx_rollback`
        }),
      ),
    )

    test.it("should support savepoints", () =>
      runSql(
        Effect.gen(function* () {
          const sql = yield* Sql.SqlClient
          yield* sql`DROP TABLE IF EXISTS sp_test`
          yield* sql`CREATE TABLE sp_test (id SERIAL PRIMARY KEY, name TEXT)`

          yield* sql.withTransaction(
            Effect.gen(function* () {
              yield* sql`INSERT INTO sp_test (name) VALUES (${"outer"})`
              const spResult = yield* sql
                .withTransaction(
                  Effect.gen(function* () {
                    yield* sql`Insert INTO sp_test (name) VALUES (${"inner"})`
                    return yield* Effect.fail(
                      new Sql.SqlError({ code: "TEST", message: "rollback sp" }),
                    )
                  }),
                )
                .pipe(Effect.either)

              test.expect(Either.isLeft(spResult)).toBe(true)
            }),
          )

          const rows = yield* sql<{ name: string }>`SELECT * FROM sp_test`

          test.expect(rows).toHaveLength(1)
          test.expect(rows[0].name).toBe("outer")

          yield* sql`DROP TABLE sp_test`
        }),
      ),
    )

    test.it("should commit nested savepoints on success", () =>
      runSql(
        Effect.gen(function* () {
          const sql = yield* Sql.SqlClient
          yield* sql`DROP TABLE IF EXISTS sp_commit`
          yield* sql`CREATE TABLE sp_commit (id SERIAL PRIMARY KEY, name TEXT)`

          yield* sql.withTransaction(
            Effect.gen(function* () {
              yield* sql`INSERT INTO sp_commit (name) VALUES (${"outer"})`
              yield* sql.withTransaction(sql`Insert INTO sp_commit (name) VALUES (${"inner"})`)
            }),
          )

          const rows = yield* sql<{ name: string }>`SELECT * FROM sp_commit ORDER BY id`

          test.expect(rows).toHaveLength(2)
          test.expect(rows[0].name).toBe("outer")
          test.expect(rows[1].name).toBe("inner")

          yield* sql`DROP TABLE sp_commit`
        }),
      ),
    )

    test.it("should see writes within same transaction", () =>
      runSql(
        Effect.gen(function* () {
          const sql = yield* Sql.SqlClient
          yield* sql`DROP TABLE IF EXISTS tx_visibility`
          yield* sql`CREATE TABLE tx_visibility (id SERIAL PRIMARY KEY, name TEXT)`

          yield* sql.withTransaction(
            Effect.gen(function* () {
              yield* sql`INSERT INTO tx_visibility (name) VALUES (${"first"})`
              yield* sql`INSERT INTO tx_visibility (name) VALUES (${"second"})`
              const rows = yield* sql<{
                name: string
              }>`SELECT * FROM tx_visibility ORDER BY id`

              test.expect(rows).toHaveLength(2)
              test.expect(rows[0].name).toBe("first")
              test.expect(rows[1].name).toBe("second")
            }),
          )
          yield* sql`DROP TABLE tx_visibility`
        }),
      ),
    )

    test.it("should support deeply nested savepoints", () =>
      runSql(
        Effect.gen(function* () {
          const sql = yield* Sql.SqlClient
          yield* sql`DROP TABLE IF EXISTS deep_sp`
          yield* sql`CREATE TABLE deep_sp (id SERIAL PRIMARY KEY, name TEXT)`

          yield* sql.withTransaction(
            Effect.gen(function* () {
              yield* sql`INSERT INTO deep_sp (name) VALUES (${"level_1"})`
              yield* sql.withTransaction(
                Effect.gen(function* () {
                  yield* sql`INSERT INTO deep_sp (name) VALUES (${"level_2"})`
                  const innerResult = yield* sql
                    .withTransaction(
                      Effect.gen(function* () {
                        yield* sql`INSERT INTO deep_sp (name) VALUES (${"level_3_rollback"})`
                        return yield* Effect.fail(
                          new Sql.SqlError({ code: "TEST", message: "deep rollback" }),
                        )
                      }),
                    )
                    .pipe(Effect.either)

                  test.expect(Either.isLeft(innerResult)).toBe(true)
                }),
              )
            }),
          )

          const rows = yield* sql<{ name: string }>`SELECT * FROM deep_sp ORDER BY id`

          test.expect(rows).toHaveLength(2)
          test.expect(rows[0].name).toBe("level_1")
          test.expect(rows[1].name).toBe("level_2")

          yield* sql`DROP TABLE deep_sp`
        }),
      ),
    )
  })

  test.describe("error handling", () => {
    test.it("should produce SqlError for invalid queries", () =>
      runSql(
        Effect.gen(function* () {
          const sql = yield* Sql.SqlClient
          const result = yield* sql`SELECT * FROM nonexistent_table_xyz`.pipe(Effect.either)

          test.expect(Either.isLeft(result)).toBe(true)

          if (Either.isLeft(result)) {
            test.expect(result.left._tag).toBe("SqlError")
            test.expect(result.left.code).toBe("42P01")
          }
        }),
      ),
    )

    test.it("should produce SqlError for constraint violations", () =>
      runSql(
        Effect.gen(function* () {
          const sql = yield* Sql.SqlClient
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

    test.it("should include original error as cause", () =>
      runSql(
        Effect.gen(function* () {
          const sql = yield* Sql.SqlClient
          const result = yield* sql`INVALID SQL SYNTAX`.pipe(Effect.either)

          test.expect(Either.isLeft(result)).toBe(true)

          if (Either.isLeft(result)) {
            test.expect(result.left.cause).toBeDefined()
          }
        }),
      ),
    )

    test.it("should rollback transaction on SQL error inside", () =>
      runSql(
        Effect.gen(function* () {
          const sql = yield* Sql.SqlClient
          yield* sql`DROP TABLE IF EXISTS tx_sqlerr`
          yield* sql`CREATE TABLE tx_sqlerr (id SERIAL PRIMARY KEY, name TEXT)`
          yield* sql`INSERT INTO tx_sqlerr (name) VALUES (${"before"})`

          const result = yield* sql
            .withTransaction(
              Effect.gen(function* () {
                yield* sql`INSERT INTO tx_sqlerr (name) VALUES (${"in_tx"})`
                yield* sql`SELECT * FROM this_table_does_not_exist`
              }),
            )
            .pipe(Effect.either)

          test.expect(Either.isLeft(result)).toBe(true)

          if (Either.isLeft(result)) {
            test.expect(result.left._tag).toBe("SqlError")
          }

          const rows = yield* sql<{ name: string }>`SELECT * FROM tx_sqlerr`

          test.expect(rows).toHaveLength(1)
          test.expect(rows[0].name).toBe("before")

          yield* sql`DROP TABLE tx_sqlerr`
        }),
      ),
    )

    test.it("should rollback savepoint on SQL error inside nested transaction", () =>
      runSql(
        Effect.gen(function* () {
          const sql = yield* Sql.SqlClient
          yield* sql`DROP TABLE IF EXISTS sp_sqlerr`
          yield* sql`CREATE TABLE sp_sqlerr (id SERIAL PRIMARY KEY, name TEXT)`

          yield* sql.withTransaction(
            Effect.gen(function* () {
              yield* sql`Insert INTO sp_sqlerr (name) VALUES (${"outer"})`

              const inner = yield* sql
                .withTransaction(
                  Effect.gen(function* () {
                    yield* sql`INSERT INTO sp_sqlerr (name) VALUES (${"inner"})`
                    yield* sql`SELECT * FROM no_such_table`
                  }),
                )
                .pipe(Effect.either)

              test.expect(Either.isLeft(inner)).toBe(true)

              if (Either.isLeft(inner)) {
                test.expect(inner.left._tag).toBe("SqlError")
              }
            }),
          )

          const rows = yield* sql<{ name: string }>`SELECT * FROM sp_sqlerr`

          test.expect(rows).toHaveLength(1)
          test.expect(rows[0].name).toBe("outer")

          yield* sql`DROP TABLE sp_sqlerr`
        }),
      ),
    )
  })

  test.describe("values helper", () => {
    test.it("should create helper with all columns", () =>
      runSql(
        Effect.gen(function* () {
          const sql = yield* Sql.SqlClient
          const helper = sql.values({ name: "Charlie", age: 30 })

          test.expect(helper.value).toEqual([{ name: "Charlie", age: 30 }])
          test.expect(helper.columns).toEqual(["name", "age"])
        }),
      ),
    )

    test.it("should pick specific columns", () =>
      runSql(
        Effect.gen(function* () {
          const sql = yield* Sql.SqlClient
          const helper = sql.values({ name: "Charlie", age: 30, email: "c@d.com" }, "name", "age")

          test.expect(helper.columns).toEqual(["name", "age"])
        }),
      ),
    )

    test.it("should handle arrays of objects", () =>
      runSql(
        Effect.gen(function* () {
          const sql = yield* Sql.SqlClient
          const helper = sql.values([
            { name: "Alice", age: 25 },
            { name: "Bob", age: 30 },
          ])

          test.expect(helper.value).toHaveLength(2)
          test.expect(helper.columns).toEqual(["name", "age"])
        }),
      ),
    )
  })

  test.describe("multiple data types", () => {
    test.it("should handle various Postgres types", () =>
      runSql(
        Effect.gen(function* () {
          const sql = yield* Sql.SqlClient
          yield* sql`DROP TABLE IF EXISTS types_test`
          yield* sql`CREATE TABLE types_test (
            int_val INTEGER,
            real_val DOUBLE PRECISION,
            text_val TEXT,
            bool_val BOOLEAN,
            null_val TEXT
          )`
          yield* sql`INSERT INTO types_test VALUES (${42}, ${3.14}, ${"hello"}, ${true}, ${null})`
          const rows = yield* sql<{
            int_val: number
            real_val: number
            text_val: string
            bool_val: boolean
            null_val: string | null
          }>`SELECT * FROM types_test`

          test.expect(rows).toHaveLength(1)
          test.expect(rows[0].int_val).toBe(42)
          test.expect(rows[0].real_val).toBeCloseTo(3.14)
          test.expect(rows[0].text_val).toBe("hello")
          test.expect(rows[0].bool_val).toBe(true)
          test.expect(rows[0].null_val).toBeNull()

          yield* sql`DROP TABLE types_test`
        }),
      ),
    )
  })

  test.describe("notify", () => {
    test.it("should send NOTIFY via unsafe", () =>
      runSql(
        Effect.gen(function* () {
          const sql = yield* Sql.SqlClient
          yield* sql.unsafe("NOTIFY test_chan, 'hello'")
        }),
      ),
    )

    test.it("should send NOTIFY via pg_notify", () =>
      runSql(
        Effect.gen(function* () {
          const sql = yield* Sql.SqlClient
          const rows = yield* sql`SELECT pg_notify(${"test_chan"}, ${"payload"})`

          test.expect(rows).toHaveLength(1)
        }),
      ),
    )

    test.it("should send NOTIFY inside a transaction", () =>
      runSql(
        Effect.gen(function* () {
          const sql = yield* Sql.SqlClient
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
        Effect.scoped(
          Effect.gen(function* () {
            const sql = yield* Sql.SqlClient
            const reserved = yield* sql.reserve
            yield* reserved.unsafe("DROP TABLE IF EXISTS reserve_test")
            yield* reserved.unsafe("CREATE TABLE reserve_test (id SERIAL PRIMARY KEY, name TEXT)")
            yield* reserved.unsafe("INSERT INTO reserve_test (name) VALUES ('reserved')")
            const rows = yield* reserved<{ name: string }>`SELECT name FROM reserve_test`

            test.expect(rows).toHaveLength(1)
            test.expect(rows[0].name).toBe("reserved")

            yield* reserved.unsafe("DROP TABLE reserve_test")
          }),
        ),
      ),
    )

    test.it("should isolate reserved connection from pool", () =>
      runSql(
        Effect.scoped(
          Effect.gen(function* () {
            const sql = yield* Sql.SqlClient
            const reserved = yield* sql.reserve
            yield* reserved.unsafe("DROP TABLE IF EXISTS reserve_iso")
            yield* reserved.unsafe("CREATE TABLE reserve_iso (id SERIAL PRIMARY KEY, val INT)")
            yield* reserved.unsafe("BEGIN")
            yield* reserved.unsafe("INSERT INTO reserve_iso (val) VALUES (1)")
            // pool connection should not see uncommitted row
            const poolRows = yield* sql`SELECT * FROM reserve_iso`

            test.expect(poolRows).toHaveLength(0)

            yield* reserved.unsafe("COMMIT")
            const afterRows = yield* sql`SELECT * FROM reserve_iso`

            test.expect(afterRows).toHaveLength(1)

            yield* reserved.unsafe("DROP TABLE reserve_iso")
          }),
        ),
      ),
    )
  })

  test.describe("use", () => {
    test.it("should expose the raw postgres.js driver", () =>
      runSql(
        Effect.gen(function* () {
          const sql = yield* Sql.SqlClient
          const rows = yield* sql.use(async (pg) => {
            const result = await pg`SELECT 1 + 1 as sum`
            return result
          })

          test.expect(rows).toHaveLength(1)
          test.expect((rows as ReadonlyArray<{ sum: number }>)[0].sum).toBe(2)
        }),
      ),
    )

    test.it("should stream notifications via PubSub", () =>
      runSql(
        Effect.gen(function* () {
          const sql = yield* Sql.SqlClient
          const pubsub = yield* PubSub.unbounded<string>()
          const rt = yield* Effect.runtime<never>()
          const runFork = Runtime.runFork(rt)

          yield* sql.use(async (pg) => {
            await pg.listen("stream_chan", (payload: string) => {
              runFork(PubSub.publish(pubsub, payload))
            })
          })

          const fiber = yield* Stream.fromPubSub(pubsub).pipe(
            Stream.take(3),
            Stream.runCollect,
            Effect.fork,
          )

          yield* sql.use((pg) => pg.notify("stream_chan", "a"))
          yield* sql.use((pg) => pg.notify("stream_chan", "b"))
          yield* sql.use((pg) => pg.notify("stream_chan", "c"))

          const result = yield* Fiber.join(fiber)

          test.expect(Chunk.toReadonlyArray(result)).toEqual(["a", "b", "c"])

          yield* sql.use(async (pg) => {
            await pg.unsafe("UNLISTEN stream_chan")
          })
        }),
      ),
    )

    test.it("should wrap driver errors as SqlError", () =>
      runSql(
        Effect.gen(function* () {
          const sql = yield* Sql.SqlClient
          const result = yield* sql
            .use(async (pg) => {
              await pg`SELECT * FROM use_nonexistent_table`
            })
            .pipe(Effect.either)

          test.expect(Either.isLeft(result)).toBe(true)

          if (Either.isLeft(result)) {
            test.expect(result.left._tag).toBe("SqlError")
          }
        }),
      ),
    )
  })

  test.describe("close", () => {
    test.it("should close without error", () =>
      runSql(
        Effect.gen(function* () {
          const sql = yield* Sql.SqlClient
          yield* sql`SELECT 1`
        }),
      ),
    )
  })
})
