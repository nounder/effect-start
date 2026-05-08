import * as test from "bun:test"
import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as SynchronizedRef from "effect/SynchronizedRef"
import * as LayerExtra from "../../src/internal/LayerExtra.ts"

class Logger extends Context.Tag("LayerExtra.test.Logger")<
  Logger,
  { log: (msg: string) => Effect.Effect<void> }
>() {}
class Database extends Context.Tag("LayerExtra.test.Database")<
  Database,
  { query: (sql: string) => Effect.Effect<unknown> }
>() {}
class UserRepo extends Context.Tag("LayerExtra.test.UserRepo")<
  UserRepo,
  { findUser: (id: string) => Effect.Effect<unknown> }
>() {}
class ExternalApi extends Context.Tag("LayerExtra.test.ExternalApi")<
  ExternalApi,
  { call: () => Effect.Effect<void> }
>() {}

const LoggerLive = Layer.succeed(Logger, { log: (msg) => Effect.log(msg) })

const DatabaseLive = Layer.effect(
  Database,
  Effect.gen(function*() {
    const logger = yield* Logger
    yield* logger.log("Connecting to database...")
    return { query: (_sql) => Effect.succeed({ rows: [] }) }
  }),
)

const UserRepoLive = Layer.effect(
  UserRepo,
  Effect.gen(function*() {
    const db = yield* Database
    const logger = yield* Logger
    const api = yield* ExternalApi
    yield* logger.log("UserRepo initialized")
    yield* api.call()
    return {
      findUser: (id) => db.query(`SELECT * FROM users WHERE id = ${id}`),
    }
  }),
)

const ExternalApiLive = Layer.succeed(ExternalApi, { call: () => Effect.void })

test.describe(LayerExtra.provideMergeAll, () => {
  test.test("resolves dependencies when ordered dependents-first", () => {
    const AppLayer = LayerExtra.provideMergeAll(
      UserRepoLive,
      DatabaseLive,
      LoggerLive,
    )

    return Effect
      .gen(function*() {
        const userRepo = yield* UserRepo
        const result = yield* userRepo.findUser("123")

        test
          .expect(result)
          .toEqual({ rows: [] })
      })
      .pipe(
        Effect.provide(AppLayer),
        Effect.provide(ExternalApiLive),
        Effect.runPromise,
      )
  })

  test.test("exposes every provided service", () => {
    const AppLayer = LayerExtra.provideMergeAll(
      UserRepoLive,
      DatabaseLive,
      LoggerLive,
    )

    return Effect
      .gen(function*() {
        yield* UserRepo
        yield* Database
        const logger = yield* Logger
        yield* logger.log("All services available!")
      })
      .pipe(
        Effect.provide(AppLayer),
        Effect.provide(ExternalApiLive),
        Effect.runPromise,
      )
  })

  test.test("memoizes shared dependencies", () => {
    let loggerBuildCount = 0
    let databaseBuildCount = 0

    const LoggerLiveWithCounter = Layer.effect(
      Logger,
      Effect.sync(() => {
        loggerBuildCount++
        return { log: (msg) => Effect.log(msg) }
      }),
    )

    const DatabaseLiveWithCounter = Layer.effect(
      Database,
      Effect.gen(function*() {
        databaseBuildCount++
        const logger = yield* Logger
        yield* logger.log("DB init")
        return { query: (_sql) => Effect.succeed({ rows: [] }) }
      }),
    )

    const UserRepoLiveWithCounter = Layer.effect(
      UserRepo,
      Effect.gen(function*() {
        const db = yield* Database
        const logger = yield* Logger
        yield* logger.log("UserRepo init")
        return {
          findUser: (id) => db.query(`SELECT * FROM users WHERE id = ${id}`),
        }
      }),
    )

    const AppLayer = LayerExtra.provideMergeAll(
      UserRepoLiveWithCounter,
      DatabaseLiveWithCounter,
      LoggerLiveWithCounter,
    )

    return Effect
      .gen(function*() {
        yield* UserRepo
        yield* Database
        yield* Logger

        test
          .expect(loggerBuildCount)
          .toEqual(1)
        test
          .expect(databaseBuildCount)
          .toEqual(1)
      })
      .pipe(
        Effect.provide(AppLayer),
        Effect.runPromise,
      )
  })
})

test.describe(LayerExtra.buildUnordered, () => {
  test.test("resolves dependencies regardless of order", () => {
    const AppLayer = Layer.scopedContext(
      LayerExtra.buildUnordered([LoggerLive, DatabaseLive, UserRepoLive]),
    )

    return Effect
      .gen(function*() {
        const userRepo = yield* UserRepo
        const result = yield* userRepo.findUser("123")

        test
          .expect(result)
          .toEqual({ rows: [] })
      })
      .pipe(
        Effect.provide(AppLayer),
        Effect.provide(ExternalApiLive),
        Effect.runPromise,
      )
  })

  test.test("works with dependents-first order too", () => {
    const AppLayer = Layer.scopedContext(
      LayerExtra.buildUnordered([UserRepoLive, DatabaseLive, LoggerLive]),
    )

    return Effect
      .gen(function*() {
        const userRepo = yield* UserRepo
        const result = yield* userRepo.findUser("456")

        test
          .expect(result)
          .toEqual({ rows: [] })
      })
      .pipe(
        Effect.provide(AppLayer),
        Effect.provide(ExternalApiLive),
        Effect.runPromise,
      )
  })

  test.test("memoizes shared dependencies", () => {
    let loggerBuildCount = 0
    let databaseBuildCount = 0

    const LoggerLiveWithCounter = Layer.effect(
      Logger,
      Effect.sync(() => {
        loggerBuildCount++
        return { log: (msg) => Effect.log(msg) }
      }),
    )

    const DatabaseLiveWithCounter = Layer.effect(
      Database,
      Effect.gen(function*() {
        const logger = yield* Logger
        databaseBuildCount++
        yield* logger.log("DB init")
        return { query: (_sql) => Effect.succeed({ rows: [] }) }
      }),
    )

    const UserRepoLiveWithCounter = Layer.effect(
      UserRepo,
      Effect.gen(function*() {
        const db = yield* Database
        const logger = yield* Logger
        yield* logger.log("UserRepo init")
        return {
          findUser: (id) => db.query(`SELECT * FROM users WHERE id = ${id}`),
        }
      }),
    )

    const AppLayer = Layer.scopedContext(
      LayerExtra.buildUnordered([
        UserRepoLiveWithCounter,
        DatabaseLiveWithCounter,
        LoggerLiveWithCounter,
      ]),
    )

    return Effect
      .gen(function*() {
        yield* UserRepo
        yield* Database
        yield* Logger

        test
          .expect(loggerBuildCount)
          .toEqual(1)
        test
          .expect(databaseBuildCount)
          .toEqual(1)
      })
      .pipe(
        Effect.provide(AppLayer),
        Effect.provide(ExternalApiLive),
        Effect.runPromise,
      )
  })
})

// `buildUnordered` reaches into MemoMap internals to invalidate failed-build
// entries so out-of-order layers can be retried once their dependencies become
// available. These tests pin the Effect-internal assumptions that logic relies
// on; if they ever fail, update LayerExtra.buildUnordered accordingly.
test.describe("buildUnordered Effect-internal assumptions", () => {
  test.test("MemoMap exposes a SynchronizedRef<Map> at .ref", () =>
    Effect
      .gen(function*() {
        const memoMap = yield* Layer.makeMemoMap
        const ref = (memoMap as unknown as { ref?: unknown }).ref

        test
          .expect(ref)
          .toBeDefined()
        test
          .expect(SynchronizedRef.SynchronizedRefTypeId in (ref as object))
          .toBe(true)

        const map = yield* SynchronizedRef.get(
          ref as SynchronizedRef.SynchronizedRef<unknown>,
        )

        test
          .expect(map)
          .toBeInstanceOf(Map)
      })
      .pipe(Effect.runPromise))

  test.test("MemoMap caches failed builds and replays the same failure", () =>
    Effect
      .gen(function*() {
        const memoMap = yield* Layer.makeMemoMap
        const failingLayer = Layer.effect(
          Logger,
          Effect.fail("boom" as const),
        ) as Layer.Layer<
          Logger,
          "boom"
        >

        const first = yield* Layer
          .buildWithMemoMap(
            failingLayer,
            memoMap,
            yield* Effect.scope,
          )
          .pipe(
            Effect.exit,
          )
        const second = yield* Layer
          .buildWithMemoMap(
            failingLayer,
            memoMap,
            yield* Effect.scope,
          )
          .pipe(
            Effect.exit,
          )

        test
          .expect(first._tag)
          .toBe("Failure")
        test
          .expect(second._tag)
          .toBe("Failure")

        const ref = (
          memoMap as unknown as {
            ref: SynchronizedRef.SynchronizedRef<Map<unknown, unknown>>
          }
        )
          .ref
        const map = yield* SynchronizedRef.get(ref)

        test
          .expect(map.has(failingLayer))
          .toBe(true)
      })
      .pipe(
        Effect.scoped,
        Effect.runPromise,
      ))
})
