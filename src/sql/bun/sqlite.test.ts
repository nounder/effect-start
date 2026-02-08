import * as test from "bun:test"
import * as Effect from "effect/Effect"
import * as Either from "effect/Either"
import * as Sql from "../../Sql.ts"
import * as BunSql from "./index.ts"

const runSql = <A, E>(effect: Effect.Effect<A, E, Sql.SqlClient>) =>
  Effect.runPromise(
    Effect.provide(effect, BunSql.layer({ adapter: "sqlite", filename: ":memory:" })),
  )

test.describe("BunSql", () => {
  test.describe("basic queries", () => {
    test.it("should create table and insert rows", () =>
      runSql(
        Effect.gen(function* () {
          const sql = yield* Sql.SqlClient
          yield* sql`CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT)`
          yield* sql`INSERT INTO users (name) VALUES (${"Alice"})`
          yield* sql`INSERT INTO users (name) VALUES (${"Bob"})`
          const rows = yield* sql<{ id: number; name: string }>`SELECT * FROM users ORDER BY id`

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
          yield* sql`CREATE TABLE empty_test (id INTEGER PRIMARY KEY)`
          const rows = yield* sql`SELECT * FROM empty_test`

          test.expect(rows).toHaveLength(0)
        }),
      ),
    )

    test.it("should handle parameterized queries", () =>
      runSql(
        Effect.gen(function* () {
          const sql = yield* Sql.SqlClient
          yield* sql`CREATE TABLE params (id INTEGER PRIMARY KEY, value TEXT, count INTEGER)`
          yield* sql`INSERT INTO params (value, count) VALUES (${"hello"}, ${42})`
          const rows = yield* sql<{
            value: string
            count: number
          }>`SELECT value, count FROM params WHERE count > ${10}`

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
          yield* sql.unsafe("CREATE TABLE raw_test (id INTEGER PRIMARY KEY, name TEXT)")
          yield* sql.unsafe("INSERT INTO raw_test (name) VALUES ('test')")
          const rows = yield* sql.unsafe<{ id: number; name: string }>("SELECT * FROM raw_test")

          test.expect(rows).toHaveLength(1)
          test.expect(rows[0]).toEqual({ id: 1, name: "test" })
        }),
      ),
    )

    test.it("should execute unsafe with parameter values", () =>
      runSql(
        Effect.gen(function* () {
          const sql = yield* Sql.SqlClient
          yield* sql.unsafe(
            "CREATE TABLE unsafe_params (id INTEGER PRIMARY KEY, name TEXT, age INT)",
          )
          yield* sql.unsafe("INSERT INTO unsafe_params (name, age) VALUES (?, ?)", ["Alice", 30])
          const rows = yield* sql.unsafe<{ name: string; age: number }>(
            "SELECT name, age FROM unsafe_params WHERE age > ?",
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
          yield* sql.unsafe("CREATE TABLE unsafe_tx (id INTEGER PRIMARY KEY, name TEXT)")

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
        }),
      ),
    )
  })

  test.describe("transactions", () => {
    test.it("should commit on success", () =>
      runSql(
        Effect.gen(function* () {
          const sql = yield* Sql.SqlClient
          yield* sql`CREATE TABLE tx_test (id INTEGER PRIMARY KEY, name TEXT)`
          yield* sql.withTransaction(sql`INSERT INTO tx_test (name) VALUES (${"in_tx"})`)
          const rows = yield* sql`SELECT * FROM tx_test`

          test.expect(rows).toHaveLength(1)
        }),
      ),
    )

    test.it("should rollback on failure", () =>
      runSql(
        Effect.gen(function* () {
          const sql = yield* Sql.SqlClient
          yield* sql`CREATE TABLE tx_rollback (id INTEGER PRIMARY KEY, name TEXT)`
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
        }),
      ),
    )

    test.it("should support savepoints", () =>
      runSql(
        Effect.gen(function* () {
          const sql = yield* Sql.SqlClient
          yield* sql`CREATE TABLE sp_test (id INTEGER PRIMARY KEY, name TEXT)`

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
        }),
      ),
    )

    test.it("should support deeply nested savepoints", () =>
      runSql(
        Effect.gen(function* () {
          const sql = yield* Sql.SqlClient
          yield* sql`CREATE TABLE deep_sp (id INTEGER PRIMARY KEY, name TEXT)`

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
        }),
      ),
    )

    test.it("should commit nested savepoints on success", () =>
      runSql(
        Effect.gen(function* () {
          const sql = yield* Sql.SqlClient
          yield* sql`CREATE TABLE sp_commit (id INTEGER PRIMARY KEY, name TEXT)`

          yield* sql.withTransaction(
            Effect.gen(function* () {
              yield* sql`INSERT INTO sp_commit (name) VALUES (${"outer"})`
              yield* sql.withTransaction(sql`INSERT INTO sp_commit (name) VALUES (${"inner"})`)
            }),
          )

          const rows = yield* sql<{ name: string }>`SELECT * FROM sp_commit ORDER BY id`

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
          yield* sql`CREATE TABLE tx_visibility (id INTEGER PRIMARY KEY, name TEXT)`

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
        }),
      ),
    )
  })

  test.describe("error handling", () => {
    test.it("should produce SqlError for invalid queries", () =>
      runSql(
        Effect.gen(function* () {
          const sql = yield* Sql.SqlClient
          const result = yield* sql`SELECT * FROM nonexistent_table`.pipe(Effect.either)

          test.expect(Either.isLeft(result)).toBe(true)

          if (Either.isLeft(result)) {
            test.expect(result.left._tag).toBe("SqlError")
            test.expect(result.left.code).toBe("SQLITE_ERROR")
          }
        }),
      ),
    )

    test.it("should produce SqlError for constraint violations", () =>
      runSql(
        Effect.gen(function* () {
          const sql = yield* Sql.SqlClient
          yield* sql`CREATE TABLE unique_test (id INTEGER PRIMARY KEY, email TEXT UNIQUE)`
          yield* sql`INSERT INTO unique_test (email) VALUES (${"a@b.com"})`
          const result = yield* sql`INSERT INTO unique_test (email) VALUES (${"a@b.com"})`.pipe(
            Effect.either,
          )

          test.expect(Either.isLeft(result)).toBe(true)

          if (Either.isLeft(result)) {
            test.expect(result.left._tag).toBe("SqlError")
            test.expect(result.left.code).toStartWith("SQLITE_CONSTRAINT")
          }
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
          yield* sql`CREATE TABLE tx_sqlerr (id INTEGER PRIMARY KEY, name TEXT)`
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
        }),
      ),
    )

    test.it("should rollback savepoint on SQL error inside nested transaction", () =>
      runSql(
        Effect.gen(function* () {
          const sql = yield* Sql.SqlClient
          yield* sql`CREATE TABLE sp_sqlerr (id INTEGER PRIMARY KEY, name TEXT)`

          yield* sql.withTransaction(
            Effect.gen(function* () {
              yield* sql`INSERT INTO sp_sqlerr (name) VALUES (${"outer"})`

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
    test.it("should handle various SQLite types", () =>
      runSql(
        Effect.gen(function* () {
          const sql = yield* Sql.SqlClient
          yield* sql`CREATE TABLE types_test (
            int_val INTEGER,
            real_val REAL,
            text_val TEXT,
            blob_val BLOB,
            null_val TEXT
          )`
          yield* sql`INSERT INTO types_test VALUES (${42}, ${3.14}, ${"hello"}, ${new Uint8Array([1, 2, 3])}, ${null})`
          const rows = yield* sql<{
            int_val: number
            real_val: number
            text_val: string
            blob_val: Uint8Array
            null_val: string | null
          }>`SELECT * FROM types_test`

          test.expect(rows).toHaveLength(1)
          test.expect(rows[0].int_val).toBe(42)
          test.expect(rows[0].real_val).toBeCloseTo(3.14)
          test.expect(rows[0].text_val).toBe("hello")
          test.expect(rows[0].null_val).toBeNull()
        }),
      ),
    )
  })

  test.describe("use", () => {
    test.it("should expose the raw Bun.SQL driver", () =>
      runSql(
        Effect.gen(function* () {
          const sql = yield* Sql.SqlClient
          const rows = yield* sql.use(async (bunSql) => {
            const result = await bunSql`SELECT 1 + 1 as sum`
            return result
          })

          test.expect(rows).toHaveLength(1)
          test.expect((rows as ReadonlyArray<{ sum: number }>)[0].sum).toBe(2)
        }),
      ),
    )

    test.it("should wrap driver errors as SqlError", () =>
      runSql(
        Effect.gen(function* () {
          const sql = yield* Sql.SqlClient
          const result = yield* sql
            .use(async (bunSql) => {
              await bunSql`SELECT * FROM use_nonexistent_table`
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
