import * as test from "bun:test"
import * as Effect from "effect/Effect"
import * as Either from "effect/Either"
import * as Sql from "../Sql.ts"
import * as Mssql from "./index.ts"
import * as MssqlDocker from "./docker.ts"

const testConfig: Mssql.MssqlConfig = {
  server: "localhost",
  user: "sa",
  password: "TestPass123",
  port: 1433,
  options: { encrypt: true, trustServerCertificate: true },
}

const runSql = <A, E>(effect: Effect.Effect<A, E, Sql.SqlClient>) =>
  Effect.runPromise(Effect.provide(effect, Mssql.layer(testConfig)))

test.describe.skipIf(!process.env.TEST_SQL)("Mssql", () => {
  test.beforeAll(() => MssqlDocker.start(), 120_000)

  test.afterAll(() => MssqlDocker.stop())

  test.describe("basic queries", () => {
    test.it("should create table and insert rows", () =>
      runSql(
        Effect.gen(function* () {
          const sql = yield* Sql.SqlClient
          yield* sql.unsafe("DROP TABLE IF EXISTS mssql_users")
          yield* sql`CREATE TABLE mssql_users (id INT IDENTITY(1,1) PRIMARY KEY, name NVARCHAR(255))`
          yield* sql`INSERT INTO mssql_users (name) VALUES (${"Alice"})`
          yield* sql`INSERT INTO mssql_users (name) VALUES (${"Bob"})`
          const rows = yield* sql<{
            id: number
            name: string
          }>`SELECT * FROM mssql_users ORDER BY id`

          test.expect(rows).toHaveLength(2)
          test.expect(rows[0]).toEqual({ id: 1, name: "Alice" })
          test.expect(rows[1]).toEqual({ id: 2, name: "Bob" })
        }),
      ),
    )

    test.it("should return empty array for no results", () =>
      runSql(
        Effect.gen(function* () {
          const sql = yield* Sql.SqlClient
          yield* sql.unsafe("DROP TABLE IF EXISTS mssql_empty_test")
          yield* sql`CREATE TABLE mssql_empty_test (id INT IDENTITY(1,1) PRIMARY KEY)`
          const rows = yield* sql`SELECT * FROM mssql_empty_test`

          test.expect(rows).toHaveLength(0)
        }),
      ),
    )

    test.it("should handle parameterized queries", () =>
      runSql(
        Effect.gen(function* () {
          const sql = yield* Sql.SqlClient
          yield* sql.unsafe("DROP TABLE IF EXISTS mssql_params")
          yield* sql`CREATE TABLE mssql_params (id INT IDENTITY(1,1) PRIMARY KEY, value NVARCHAR(255), count INT)`
          yield* sql`INSERT INTO mssql_params (value, count) VALUES (${"hello"}, ${42})`
          const rows = yield* sql<{
            value: string
            count: number
          }>`SELECT value, count FROM mssql_params WHERE count > ${10}`

          test.expect(rows).toHaveLength(1)
          test.expect(rows[0]).toEqual({ value: "hello", count: 42 })
        }),
      ),
    )
  })

  test.describe("unsafe queries", () => {
    test.it("should execute raw SQL strings", () =>
      runSql(
        Effect.gen(function* () {
          const sql = yield* Sql.SqlClient
          yield* sql.unsafe("DROP TABLE IF EXISTS mssql_raw_test")
          yield* sql.unsafe(
            "CREATE TABLE mssql_raw_test (id INT IDENTITY(1,1) PRIMARY KEY, name NVARCHAR(255))",
          )
          yield* sql.unsafe("INSERT INTO mssql_raw_test (name) VALUES ('test')")
          const rows = yield* sql.unsafe<{ id: number; name: string }>(
            "SELECT * FROM mssql_raw_test",
          )

          test.expect(rows).toHaveLength(1)
          test.expect(rows[0]).toEqual({ id: 1, name: "test" })
        }),
      ),
    )

    test.it("should execute unsafe with parameter values", () =>
      runSql(
        Effect.gen(function* () {
          const sql = yield* Sql.SqlClient
          yield* sql.unsafe("DROP TABLE IF EXISTS mssql_unsafe_params")
          yield* sql.unsafe(
            "CREATE TABLE mssql_unsafe_params (id INT IDENTITY(1,1) PRIMARY KEY, name NVARCHAR(255), age INT)",
          )
          yield* sql.unsafe("INSERT INTO mssql_unsafe_params (name, age) VALUES (@p1, @p2)", [
            "Alice",
            30,
          ])
          const rows = yield* sql.unsafe<{ name: string; age: number }>(
            "SELECT name, age FROM mssql_unsafe_params WHERE age > @p1",
            [20],
          )

          test.expect(rows).toHaveLength(1)
          test.expect(rows[0]).toEqual({ name: "Alice", age: 30 })
        }),
      ),
    )

    test.it("should execute unsafe inside a transaction", () =>
      runSql(
        Effect.gen(function* () {
          const sql = yield* Sql.SqlClient
          yield* sql.unsafe("DROP TABLE IF EXISTS mssql_unsafe_tx")
          yield* sql.unsafe(
            "CREATE TABLE mssql_unsafe_tx (id INT IDENTITY(1,1) PRIMARY KEY, name NVARCHAR(255))",
          )

          yield* sql.withTransaction(
            Effect.gen(function* () {
              yield* sql.unsafe("INSERT INTO mssql_unsafe_tx (name) VALUES ('from_unsafe')")
              const rows = yield* sql.unsafe<{ name: string }>("SELECT name FROM mssql_unsafe_tx")

              test.expect(rows).toHaveLength(1)
              test.expect(rows[0].name).toBe("from_unsafe")
            }),
          )

          const rows = yield* sql`SELECT * FROM mssql_unsafe_tx`

          test.expect(rows).toHaveLength(1)
        }),
      ),
    )
  })

  test.describe("transactions", () => {
    test.it("should commit on success", () =>
      runSql(
        Effect.gen(function* () {
          const sql = yield* Sql.SqlClient
          yield* sql.unsafe("DROP TABLE IF EXISTS mssql_tx_test")
          yield* sql`CREATE TABLE mssql_tx_test (id INT IDENTITY(1,1) PRIMARY KEY, name NVARCHAR(255))`
          yield* sql.withTransaction(sql`INSERT INTO mssql_tx_test (name) VALUES (${"in_tx"})`)
          const rows = yield* sql`SELECT * FROM mssql_tx_test`

          test.expect(rows).toHaveLength(1)
        }),
      ),
    )

    test.it("should rollback on failure", () =>
      runSql(
        Effect.gen(function* () {
          const sql = yield* Sql.SqlClient
          yield* sql.unsafe("DROP TABLE IF EXISTS mssql_tx_rollback")
          yield* sql`CREATE TABLE mssql_tx_rollback (id INT IDENTITY(1,1) PRIMARY KEY, name NVARCHAR(255))`
          yield* sql`INSERT INTO mssql_tx_rollback (name) VALUES (${"before"})`

          const result = yield* sql
            .withTransaction(
              Effect.gen(function* () {
                yield* sql`INSERT INTO mssql_tx_rollback (name) VALUES (${"should_rollback"})`
                return yield* Effect.fail(
                  new Sql.SqlError({ code: "TEST", message: "intentional" }),
                )
              }),
            )
            .pipe(Effect.either)

          test.expect(Either.isLeft(result)).toBe(true)

          const rows = yield* sql<{ name: string }>`SELECT * FROM mssql_tx_rollback`

          test.expect(rows).toHaveLength(1)
          test.expect(rows[0].name).toBe("before")
        }),
      ),
    )

    test.it("should support savepoints", () =>
      runSql(
        Effect.gen(function* () {
          const sql = yield* Sql.SqlClient
          yield* sql.unsafe("DROP TABLE IF EXISTS mssql_sp_test")
          yield* sql`CREATE TABLE mssql_sp_test (id INT IDENTITY(1,1) PRIMARY KEY, name NVARCHAR(255))`

          yield* sql.withTransaction(
            Effect.gen(function* () {
              yield* sql`INSERT INTO mssql_sp_test (name) VALUES (${"outer"})`
              const spResult = yield* sql
                .withTransaction(
                  Effect.gen(function* () {
                    yield* sql`INSERT INTO mssql_sp_test (name) VALUES (${"inner"})`
                    return yield* Effect.fail(
                      new Sql.SqlError({ code: "TEST", message: "rollback sp" }),
                    )
                  }),
                )
                .pipe(Effect.either)

              test.expect(Either.isLeft(spResult)).toBe(true)
            }),
          )

          const rows = yield* sql<{ name: string }>`SELECT * FROM mssql_sp_test`

          test.expect(rows).toHaveLength(1)
          test.expect(rows[0].name).toBe("outer")
        }),
      ),
    )

    test.it("should commit nested savepoints on success", () =>
      runSql(
        Effect.gen(function* () {
          const sql = yield* Sql.SqlClient
          yield* sql.unsafe("DROP TABLE IF EXISTS mssql_sp_commit")
          yield* sql`CREATE TABLE mssql_sp_commit (id INT IDENTITY(1,1) PRIMARY KEY, name NVARCHAR(255))`

          yield* sql.withTransaction(
            Effect.gen(function* () {
              yield* sql`INSERT INTO mssql_sp_commit (name) VALUES (${"outer"})`
              yield* sql.withTransaction(
                sql`INSERT INTO mssql_sp_commit (name) VALUES (${"inner"})`,
              )
            }),
          )

          const rows = yield* sql<{ name: string }>`SELECT * FROM mssql_sp_commit ORDER BY id`

          test.expect(rows).toHaveLength(2)
          test.expect(rows[0].name).toBe("outer")
          test.expect(rows[1].name).toBe("inner")
        }),
      ),
    )

    test.it("should see writes within same transaction", () =>
      runSql(
        Effect.gen(function* () {
          const sql = yield* Sql.SqlClient
          yield* sql.unsafe("DROP TABLE IF EXISTS mssql_tx_visibility")
          yield* sql`CREATE TABLE mssql_tx_visibility (id INT IDENTITY(1,1) PRIMARY KEY, name NVARCHAR(255))`

          yield* sql.withTransaction(
            Effect.gen(function* () {
              yield* sql`INSERT INTO mssql_tx_visibility (name) VALUES (${"first"})`
              yield* sql`INSERT INTO mssql_tx_visibility (name) VALUES (${"second"})`
              const rows = yield* sql<{
                name: string
              }>`SELECT * FROM mssql_tx_visibility ORDER BY id`

              test.expect(rows).toHaveLength(2)
              test.expect(rows[0].name).toBe("first")
              test.expect(rows[1].name).toBe("second")
            }),
          )
        }),
      ),
    )

    test.it("should support deeply nested savepoints", () =>
      runSql(
        Effect.gen(function* () {
          const sql = yield* Sql.SqlClient
          yield* sql.unsafe("DROP TABLE IF EXISTS mssql_deep_sp")
          yield* sql`CREATE TABLE mssql_deep_sp (id INT IDENTITY(1,1) PRIMARY KEY, name NVARCHAR(255))`

          yield* sql.withTransaction(
            Effect.gen(function* () {
              yield* sql`INSERT INTO mssql_deep_sp (name) VALUES (${"level_1"})`
              yield* sql.withTransaction(
                Effect.gen(function* () {
                  yield* sql`INSERT INTO mssql_deep_sp (name) VALUES (${"level_2"})`
                  const innerResult = yield* sql
                    .withTransaction(
                      Effect.gen(function* () {
                        yield* sql`INSERT INTO mssql_deep_sp (name) VALUES (${"level_3_rollback"})`
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

          const rows = yield* sql<{ name: string }>`SELECT * FROM mssql_deep_sp ORDER BY id`

          test.expect(rows).toHaveLength(2)
          test.expect(rows[0].name).toBe("level_1")
          test.expect(rows[1].name).toBe("level_2")
        }),
      ),
    )
  })

  test.describe("error handling", () => {
    test.it("should produce SqlError for invalid queries", () =>
      runSql(
        Effect.gen(function* () {
          const sql = yield* Sql.SqlClient
          const result = yield* sql`SELECT * FROM mssql_nonexistent_table`.pipe(Effect.either)

          test.expect(Either.isLeft(result)).toBe(true)

          if (Either.isLeft(result)) {
            test.expect(result.left._tag).toBe("SqlError")
          }
        }),
      ),
    )

    test.it("should produce SqlError for constraint violations", () =>
      runSql(
        Effect.gen(function* () {
          const sql = yield* Sql.SqlClient
          yield* sql.unsafe("DROP TABLE IF EXISTS mssql_unique_test")
          yield* sql`CREATE TABLE mssql_unique_test (id INT IDENTITY(1,1) PRIMARY KEY, email NVARCHAR(255) UNIQUE)`
          yield* sql`INSERT INTO mssql_unique_test (email) VALUES (${"a@b.com"})`
          const result =
            yield* sql`INSERT INTO mssql_unique_test (email) VALUES (${"a@b.com"})`.pipe(
              Effect.either,
            )

          test.expect(Either.isLeft(result)).toBe(true)

          if (Either.isLeft(result)) {
            test.expect(result.left._tag).toBe("SqlError")
          }
        }),
      ),
    )

    test.it("should include original error as cause", () =>
      runSql(
        Effect.gen(function* () {
          const sql = yield* Sql.SqlClient
          const result = yield* sql.unsafe("INVALID SQL SYNTAX").pipe(Effect.either)

          test.expect(Either.isLeft(result)).toBe(true)

          if (Either.isLeft(result)) {
            test.expect(result.left.cause).toBeDefined()
          }
        }),
      ),
    )

    test.it("should produce SqlError on connection failure", () => {
      const badLayer = Mssql.layer({
        server: "localhost",
        user: "sa",
        password: "wrong",
        port: 1433,
        options: { encrypt: true, trustServerCertificate: true },
      })
      return Effect.runPromise(
        Effect.gen(function* () {
          const result = yield* Effect.provide(
            Effect.gen(function* () {
              const sql = yield* Sql.SqlClient
              return yield* sql`SELECT 1 AS val`
            }),
            badLayer,
          ).pipe(Effect.either)

          test.expect(Either.isLeft(result)).toBe(true)

          if (Either.isLeft(result)) {
            test.expect(result.left._tag).toBe("SqlError")
            test.expect(result.left.code).toBe("ELOGIN")
          }
        }),
      )
    })

    test.it("should rollback transaction on SQL error inside", () =>
      runSql(
        Effect.gen(function* () {
          const sql = yield* Sql.SqlClient
          yield* sql.unsafe("DROP TABLE IF EXISTS mssql_tx_sqlerr")
          yield* sql`CREATE TABLE mssql_tx_sqlerr (id INT IDENTITY(1,1) PRIMARY KEY, name NVARCHAR(255))`
          yield* sql`INSERT INTO mssql_tx_sqlerr (name) VALUES (${"before"})`

          const result = yield* sql
            .withTransaction(
              Effect.gen(function* () {
                yield* sql`INSERT INTO mssql_tx_sqlerr (name) VALUES (${"in_tx"})`
                yield* sql`SELECT * FROM mssql_this_table_does_not_exist`
              }),
            )
            .pipe(Effect.either)

          test.expect(Either.isLeft(result)).toBe(true)

          if (Either.isLeft(result)) {
            test.expect(result.left._tag).toBe("SqlError")
          }

          const rows = yield* sql<{ name: string }>`SELECT * FROM mssql_tx_sqlerr`

          test.expect(rows).toHaveLength(1)
          test.expect(rows[0].name).toBe("before")
        }),
      ),
    )

    test.it("should rollback savepoint on SQL error inside nested transaction", () =>
      runSql(
        Effect.gen(function* () {
          const sql = yield* Sql.SqlClient
          yield* sql.unsafe("DROP TABLE IF EXISTS mssql_sp_sqlerr")
          yield* sql`CREATE TABLE mssql_sp_sqlerr (id INT IDENTITY(1,1) PRIMARY KEY, name NVARCHAR(255))`

          yield* sql.withTransaction(
            Effect.gen(function* () {
              yield* sql`INSERT INTO mssql_sp_sqlerr (name) VALUES (${"outer"})`

              const inner = yield* sql
                .withTransaction(
                  Effect.gen(function* () {
                    yield* sql`INSERT INTO mssql_sp_sqlerr (name) VALUES (${"inner"})`
                    yield* sql`SELECT * FROM mssql_no_such_table`
                  }),
                )
                .pipe(Effect.either)

              test.expect(Either.isLeft(inner)).toBe(true)

              if (Either.isLeft(inner)) {
                test.expect(inner.left._tag).toBe("SqlError")
              }
            }),
          )

          const rows = yield* sql<{ name: string }>`SELECT * FROM mssql_sp_sqlerr`

          test.expect(rows).toHaveLength(1)
          test.expect(rows[0].name).toBe("outer")
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
    test.it("should handle various MSSQL types", () =>
      runSql(
        Effect.gen(function* () {
          const sql = yield* Sql.SqlClient
          yield* sql.unsafe("DROP TABLE IF EXISTS mssql_types_test")
          yield* sql`CREATE TABLE mssql_types_test (
            int_val INT,
            float_val FLOAT,
            text_val NVARCHAR(255),
            bin_val VARBINARY(MAX),
            null_val NVARCHAR(255)
          )`
          yield* sql`INSERT INTO mssql_types_test VALUES (${42}, ${3.14}, ${"hello"}, ${Buffer.from([1, 2, 3])}, ${null})`
          const rows = yield* sql<{
            int_val: number
            float_val: number
            text_val: string
            bin_val: Buffer
            null_val: string | null
          }>`SELECT * FROM mssql_types_test`

          test.expect(rows).toHaveLength(1)
          test.expect(rows[0].int_val).toBe(42)
          test.expect(rows[0].float_val).toBeCloseTo(3.14)
          test.expect(rows[0].text_val).toBe("hello")
          test.expect(rows[0].null_val).toBeNull()
        }),
      ),
    )
  })

  test.describe("close", () => {
    test.it("should close without error", () =>
      runSql(
        Effect.gen(function* () {
          const sql = yield* Sql.SqlClient
          yield* sql.unsafe("SELECT 1 AS val")
        }),
      ),
    )
  })
})
