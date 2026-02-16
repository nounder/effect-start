import * as Cache from "effect/Cache"
import * as Context from "effect/Context"
import type * as Duration from "effect/Duration"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import type * as SqlClient from "./SqlClient.ts"

type SqlCacheInstance = Cache.Cache<string, ReadonlyArray<any>>

export class SqlCache extends Context.Tag("effect-start/SqlCache")<SqlCache, SqlCacheInstance>() {}

export function layer(options: {
  readonly capacity: number
  readonly timeToLive: Duration.DurationInput
}): Layer.Layer<SqlCache> {
  return Layer.effect(
    SqlCache,
    Cache.make<string, ReadonlyArray<any>>({
      capacity: options.capacity,
      timeToLive: options.timeToLive,
      lookup: (key) => Effect.die(`cache miss without populate for key: ${key}`),
    }),
  )
}

export function withCache(
  cache: SqlCacheInstance,
): <A extends object>(
  self: SqlClient.SqlEffect<A>,
) => Effect.Effect<ReadonlyArray<A>, SqlClient.SqlError>
export function withCache(): <A extends object>(
  self: SqlClient.SqlEffect<A>,
) => Effect.Effect<ReadonlyArray<A>, SqlClient.SqlError, SqlCache>
export function withCache(cache?: SqlCacheInstance) {
  return <A extends object>(self: SqlClient.SqlEffect<A>) => {
    const key = JSON.stringify({ sql: self.sql, parameters: self.parameters })
    if (cache) {
      return Effect.flatMap(cache.getOption(key), (option) => {
        if (option._tag === "Some") return Effect.succeed(option.value as ReadonlyArray<A>)
        return Effect.tap(self, (result) => cache.set(key, result))
      })
    }
    return Effect.flatMap(SqlCache, (c) =>
      Effect.flatMap(c.getOption(key), (option) => {
        if (option._tag === "Some") return Effect.succeed(option.value as ReadonlyArray<A>)
        return Effect.tap(self, (result) => c.set(key, result))
      }),
    )
  }
}
