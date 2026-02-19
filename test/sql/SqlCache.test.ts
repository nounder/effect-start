import * as test from "bun:test"
import * as Cache from "effect/Cache"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import { SqlCache, SqlClient } from "effect-start/sql"
import * as BunSql from "../../src/sql/bun/index.ts"

const sqlLayer = BunSql.layer({ adapter: "sqlite", filename: ":memory:" })

const runSql = <A, E>(effect: Effect.Effect<A, E, SqlClient.SqlClient>) =>
  Effect.runPromise(Effect.provide(effect, sqlLayer))

const runSqlCached = <A, E>(effect: Effect.Effect<A, E, SqlClient.SqlClient | SqlCache.SqlCache>) =>
  Effect.runPromise(
    Effect.provide(
      effect,
      Layer.mergeAll(sqlLayer, SqlCache.layer({ capacity: 100, timeToLive: "1 minutes" })),
    ),
  )

test.describe("SqlCache", () => {
  test.describe("withCache(cache)", () => {
    test.it("returns cached result on second call with same query", () =>
      runSql(
        Effect.gen(function* () {
          const sql = yield* SqlClient.SqlClient
          yield* sql`CREATE TABLE cache_test (id INTEGER PRIMARY KEY, name TEXT)`
          yield* sql`INSERT INTO cache_test (name) VALUES (${"Alice"})`

          const cache = yield* Cache.make<string, ReadonlyArray<any>>({
            capacity: 10,
            timeToLive: "1 minutes",
            lookup: (key) => Effect.die(`unexpected lookup: ${key}`),
          })

          const first = yield* sql<{ id: number; name: string }>`SELECT * FROM cache_test`.pipe(
            SqlCache.withCache(cache),
          )
          test.expect(first).toEqual([{ id: 1, name: "Alice" }])

          yield* sql`INSERT INTO cache_test (name) VALUES (${"Bob"})`

          const second = yield* sql<{ id: number; name: string }>`SELECT * FROM cache_test`.pipe(
            SqlCache.withCache(cache),
          )
          test.expect(second).toEqual([{ id: 1, name: "Alice" }])
        }),
      ),
    )

    test.it("different parameters produce different cache entries", () =>
      runSql(
        Effect.gen(function* () {
          const sql = yield* SqlClient.SqlClient
          yield* sql`CREATE TABLE cache_params (id INTEGER PRIMARY KEY, name TEXT)`
          yield* sql`INSERT INTO cache_params (name) VALUES (${"Alice"})`
          yield* sql`INSERT INTO cache_params (name) VALUES (${"Bob"})`

          const cache = yield* Cache.make<string, ReadonlyArray<any>>({
            capacity: 10,
            timeToLive: "1 minutes",
            lookup: (key) => Effect.die(`unexpected lookup: ${key}`),
          })

          const alice = yield* sql<{
            id: number
            name: string
          }>`SELECT * FROM cache_params WHERE name = ${"Alice"}`.pipe(SqlCache.withCache(cache))
          test.expect(alice).toEqual([{ id: 1, name: "Alice" }])

          const bob = yield* sql<{
            id: number
            name: string
          }>`SELECT * FROM cache_params WHERE name = ${"Bob"}`.pipe(SqlCache.withCache(cache))
          test.expect(bob).toEqual([{ id: 2, name: "Bob" }])
        }),
      ),
    )

    test.it("works with unsafe queries", () =>
      runSql(
        Effect.gen(function* () {
          const sql = yield* SqlClient.SqlClient
          yield* sql`CREATE TABLE cache_unsafe (id INTEGER PRIMARY KEY, val TEXT)`
          yield* sql`INSERT INTO cache_unsafe (val) VALUES (${"x"})`

          const cache = yield* Cache.make<string, ReadonlyArray<any>>({
            capacity: 10,
            timeToLive: "1 minutes",
            lookup: (key) => Effect.die(`unexpected lookup: ${key}`),
          })

          const first = yield* sql
            .unsafe<{ id: number; val: string }>("SELECT * FROM cache_unsafe")
            .pipe(SqlCache.withCache(cache))
          test.expect(first).toEqual([{ id: 1, val: "x" }])

          yield* sql`INSERT INTO cache_unsafe (val) VALUES (${"y"})`

          const second = yield* sql
            .unsafe<{ id: number; val: string }>("SELECT * FROM cache_unsafe")
            .pipe(SqlCache.withCache(cache))
          test.expect(second).toEqual([{ id: 1, val: "x" }])
        }),
      ),
    )
  })

  test.describe("withCache() from context", () => {
    test.it("uses SqlCache from the environment", () =>
      runSqlCached(
        Effect.gen(function* () {
          const sql = yield* SqlClient.SqlClient
          yield* sql`CREATE TABLE cache_ctx (id INTEGER PRIMARY KEY, name TEXT)`
          yield* sql`INSERT INTO cache_ctx (name) VALUES (${"Alice"})`

          const first = yield* sql<{ id: number; name: string }>`SELECT * FROM cache_ctx`.pipe(
            SqlCache.withCache(),
          )
          test.expect(first).toEqual([{ id: 1, name: "Alice" }])

          yield* sql`INSERT INTO cache_ctx (name) VALUES (${"Bob"})`

          const second = yield* sql<{ id: number; name: string }>`SELECT * FROM cache_ctx`.pipe(
            SqlCache.withCache(),
          )
          test.expect(second).toEqual([{ id: 1, name: "Alice" }])
        }),
      ),
    )

    test.it("different parameters produce different cache entries from context", () =>
      runSqlCached(
        Effect.gen(function* () {
          const sql = yield* SqlClient.SqlClient
          yield* sql`CREATE TABLE cache_ctx_params (id INTEGER PRIMARY KEY, name TEXT)`
          yield* sql`INSERT INTO cache_ctx_params (name) VALUES (${"Alice"})`
          yield* sql`INSERT INTO cache_ctx_params (name) VALUES (${"Bob"})`

          const alice = yield* sql<{
            id: number
            name: string
          }>`SELECT * FROM cache_ctx_params WHERE name = ${"Alice"}`.pipe(SqlCache.withCache())
          test.expect(alice).toEqual([{ id: 1, name: "Alice" }])

          const bob = yield* sql<{
            id: number
            name: string
          }>`SELECT * FROM cache_ctx_params WHERE name = ${"Bob"}`.pipe(SqlCache.withCache())
          test.expect(bob).toEqual([{ id: 2, name: "Bob" }])
        }),
      ),
    )
  })
})
