import * as Cache from "effect/Cache"
import * as Context from "effect/Context"
import type * as Duration from "effect/Duration"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import type * as SqlError from "effect/unstable/sql/SqlError"
import type * as Statement from "effect/unstable/sql/Statement"

type SqlCacheInstance = Cache.Cache<string, ReadonlyArray<any>>

export class SqlCache extends Context.Service<SqlCache, SqlCacheInstance>()("effect-start/SqlCache") {}

export function layer(cache: SqlCacheInstance): Layer.Layer<SqlCache>
export function layer(options: {
  readonly capacity: number
  readonly timeToLive: Duration.Input
}): Layer.Layer<SqlCache>
export function layer(
  cacheOrOptions:
    | SqlCacheInstance
    | {
      readonly capacity: number
      readonly timeToLive: Duration.Input
    },
): Layer.Layer<SqlCache> {
  if ("pipe" in cacheOrOptions) {
    return Layer.succeed(SqlCache, cacheOrOptions as SqlCacheInstance)
  }
  const options = cacheOrOptions as {
    readonly capacity: number
    readonly timeToLive: Duration.Input
  }
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
  self: Statement.Statement<A>,
) => Effect.Effect<ReadonlyArray<A>, SqlError.SqlError>
export function withCache(): <A extends object>(
  self: Statement.Statement<A>,
) => Effect.Effect<ReadonlyArray<A>, SqlError.SqlError, SqlCache>
export function withCache(cache?: SqlCacheInstance) {
  return <A extends object>(self: Statement.Statement<A>) => {
    const compiled = self.compile()
    const key = JSON.stringify({ sql: compiled[0], parameters: compiled[1] })
    if (cache) {
      return Effect.flatMap(Cache.getOption(cache, key), (option) => {
        if (option._tag === "Some") {
          return Effect.succeed(option.value as ReadonlyArray<A>)
        }
        return Effect.tap(self, (result) => Cache.set(cache, key, result))
      })
    }
    return Effect.flatMap(
      SqlCache,
      (c) =>
        Effect.flatMap(Cache.getOption(c, key), (option) => {
          if (option._tag === "Some") {
            return Effect.succeed(option.value as ReadonlyArray<A>)
          }
          return Effect.tap(self, (result) => Cache.set(c, key, result))
        }),
    )
  }
}
