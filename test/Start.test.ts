import * as test from "bun:test"
import * as Context from "effect/Context"
import * as Deferred from "effect/Deferred"
import * as Effect from "effect/Effect"
import * as Fiber from "effect/Fiber"
import * as Layer from "effect/Layer"
import * as SynchronizedRef from "effect/SynchronizedRef"
import { BunServer } from "effect-start/bun"
import * as Start from "effect-start/Start"
import * as StartApp from "../src/internal/StartApp.ts"

test.describe(Start.build, () => {
  test.test("should resolve internal dependencies automatically", () => {
    const AppLayer = Start.build(UserRepoLive, DatabaseLive, LoggerLive)

    test.expectTypeOf<Layer.Layer.Context<typeof AppLayer>>().toEqualTypeOf<ExternalApi>()

    const ExternalApiLive = Layer.succeed(ExternalApi, {
      call: () => Effect.void,
    })

    return Effect.gen(function* () {
      const userRepo = yield* UserRepo
      const result = yield* userRepo.findUser("123")

      test.expect(result).toEqual({ rows: [] })
    }).pipe(Effect.provide(AppLayer), Effect.provide(ExternalApiLive), Effect.runPromise)
  })

  test.test("should require services not in the pack", async () => {
    const PartialPack = Start.build(UserRepoLive, DatabaseLive)

    test
      .expectTypeOf<Layer.Layer.Context<typeof PartialPack>>()
      .toEqualTypeOf<Logger | ExternalApi>()
  })

  test.test("should reject wrong layer ordering", () => {
    // @ts-expect-error LoggerLive first means DatabaseLive can't find Logger
    Start.build(LoggerLive, DatabaseLive, UserRepoLive)

    // @ts-expect-error DatabaseLive before LoggerLive, UserRepoLive last but needs Database
    Start.build(DatabaseLive, LoggerLive, UserRepoLive)
  })

  test.test("should work with dependents-first order", () => {
    const AppLayer = Start.build(UserRepoLive, DatabaseLive, LoggerLive)

    const ExternalApiLive = Layer.succeed(ExternalApi, {
      call: () => Effect.void,
    })

    return Effect.gen(function* () {
      const userRepo = yield* UserRepo
      const result = yield* userRepo.findUser("456")

      test.expect(result).toEqual({ rows: [] })
    }).pipe(Effect.provide(AppLayer), Effect.provide(ExternalApiLive), Effect.runPromise)
  })

  test.test("should allow accessing all provided services", () => {
    const AppLayer = Start.build(UserRepoLive, DatabaseLive, LoggerLive)

    const ExternalApiLive = Layer.succeed(ExternalApi, {
      call: () => Effect.void,
    })

    return Effect.gen(function* () {
      yield* UserRepo
      yield* Database
      const logger = yield* Logger
      yield* logger.log("All services available!")
    }).pipe(Effect.provide(AppLayer), Effect.provide(ExternalApiLive), Effect.runPromise)
  })

  test.test("should memoize layers (build each only once)", () => {
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
      Effect.gen(function* () {
        databaseBuildCount++
        const logger = yield* Logger
        yield* logger.log("DB init")
        return { query: (sql) => Effect.succeed({ rows: [] }) }
      }),
    )

    const UserRepoLiveWithCounter = Layer.effect(
      UserRepo,
      Effect.gen(function* () {
        const db = yield* Database
        const logger = yield* Logger
        yield* logger.log("UserRepo init")
        return {
          findUser: (id) => db.query(`SELECT * FROM users WHERE id = ${id}`),
        }
      }),
    )

    const AppLayer = Start.build(
      UserRepoLiveWithCounter,
      DatabaseLiveWithCounter,
      LoggerLiveWithCounter,
    )

    const program = Effect.gen(function* () {
      yield* UserRepo
      yield* Database
      yield* Logger
      return "done"
    })

    return Effect.gen(function* () {
      yield* program

      test.expect(loggerBuildCount).toEqual(1)
      test.expect(databaseBuildCount).toEqual(1)
    }).pipe(Effect.provide(AppLayer), Effect.runPromise)
  })
})

test.describe("StartApp.server", () => {
  test.test("waits for server ready deferred in StartApp", () =>
    Effect.gen(function* () {
      const deferred = yield* Deferred.make<BunServer.BunServer>()

      const fakeServer = {
        server: { port: 1234 } as any,
        pushHandler: (_fetch: Parameters<BunServer.BunServer["pushHandler"]>[0]) => {},
        popHandler: () => {},
        setRoutes: () => Effect.void,
      } satisfies BunServer.BunServer

      const resultFiber = yield* Effect.gen(function* () {
        const app = yield* StartApp.StartApp
        return yield* Deferred.await(app.server)
      }).pipe(Effect.provide(Layer.succeed(StartApp.StartApp, { server: deferred })), Effect.fork)

      yield* Deferred.succeed(deferred, fakeServer)
      const result = yield* Fiber.join(resultFiber)

      test.expect(result).toBe(fakeServer)
    }).pipe(Effect.runPromise),
  )
})

test.describe(Start.pack, () => {
  test.test("should resolve dependencies in any order", () => {
    const AppLayer = Start.pack(LoggerLive, DatabaseLive, UserRepoLive)

    test.expectTypeOf<Layer.Layer.Context<typeof AppLayer>>().toEqualTypeOf<ExternalApi>()

    const ExternalApiLive = Layer.succeed(ExternalApi, {
      call: () => Effect.void,
    })

    return Effect.gen(function* () {
      const userRepo = yield* UserRepo
      const result = yield* userRepo.findUser("123")

      test.expect(result).toEqual({ rows: [] })
    }).pipe(Effect.provide(AppLayer), Effect.provide(ExternalApiLive), Effect.runPromise)
  })

  test.test("should resolve dependencies in correct order too", () => {
    const AppLayer = Start.pack(UserRepoLive, DatabaseLive, LoggerLive)

    test.expectTypeOf<Layer.Layer.Context<typeof AppLayer>>().toEqualTypeOf<ExternalApi>()

    const ExternalApiLive = Layer.succeed(ExternalApi, {
      call: () => Effect.void,
    })

    return Effect.gen(function* () {
      const userRepo = yield* UserRepo
      const result = yield* userRepo.findUser("456")

      test.expect(result).toEqual({ rows: [] })
    }).pipe(Effect.provide(AppLayer), Effect.provide(ExternalApiLive), Effect.runPromise)
  })

  test.test("should require external services", async () => {
    const PartialPack = Start.pack(UserRepoLive, DatabaseLive)

    test
      .expectTypeOf<Layer.Layer.Context<typeof PartialPack>>()
      .toEqualTypeOf<Logger | ExternalApi>()
  })

  test.test("should memoize layers", () => {
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
      Effect.gen(function* () {
        const logger = yield* Logger
        databaseBuildCount++
        yield* logger.log("DB init")
        return { query: (sql) => Effect.succeed({ rows: [] }) }
      }),
    )

    const UserRepoLiveWithCounter = Layer.effect(
      UserRepo,
      Effect.gen(function* () {
        const db = yield* Database
        const logger = yield* Logger
        yield* logger.log("UserRepo init")
        return {
          findUser: (id) => db.query(`SELECT * FROM users WHERE id = ${id}`),
        }
      }),
    )

    const ExternalApiLive = Layer.succeed(ExternalApi, {
      call: () => Effect.void,
    })

    const AppLayer = Start.pack(
      UserRepoLiveWithCounter,
      DatabaseLiveWithCounter,
      LoggerLiveWithCounter,
    )

    return Effect.gen(function* () {
      yield* UserRepo
      yield* Database
      yield* Logger

      test.expect(loggerBuildCount).toEqual(1)
      test.expect(databaseBuildCount).toEqual(1)
    }).pipe(Effect.provide(AppLayer), Effect.provide(ExternalApiLive), Effect.runPromise)
  })

  // Guard against Effect changing MemoMap internals. Start.pack reaches into
  // `memoMap.ref` to invalidate failed-build entries so out-of-order layers
  // can be retried once their dependencies become available.
  test.test("MemoMap exposes a SynchronizedRef<Map> at .ref", () =>
    Effect.gen(function* () {
      const memoMap = yield* Layer.makeMemoMap
      const ref = (memoMap as unknown as { ref?: unknown }).ref

      test.expect(ref).toBeDefined()
      test.expect(SynchronizedRef.SynchronizedRefTypeId in (ref as object)).toBe(true)

      const map = yield* SynchronizedRef.get(ref as SynchronizedRef.SynchronizedRef<unknown>)
      test.expect(map).toBeInstanceOf(Map)
    }).pipe(Effect.runPromise),
  )

  // Pin the behavior we rely on: a layer that fails once during a build leaves
  // a cached entry whose replay returns the same failure. Start.pack's retry
  // loop only works because we invalidate that entry; if Effect ever stops
  // persisting failures, our invalidation becomes dead code (not too bad), but if
  // the replay shape changes, our invalidation may fail to clear it.
  test.test("MemoMap caches failed builds and replays the same failure", () =>
    Effect.gen(function* () {
      const memoMap = yield* Layer.makeMemoMap
      const failingLayer = Layer.effect(Logger, Effect.fail("boom" as const)) as Layer.Layer<
        Logger,
        "boom"
      >

      const first = yield* Layer.buildWithMemoMap(failingLayer, memoMap, yield* Effect.scope).pipe(
        Effect.exit,
      )
      const second = yield* Layer.buildWithMemoMap(failingLayer, memoMap, yield* Effect.scope).pipe(
        Effect.exit,
      )

      test.expect(first._tag).toBe("Failure")
      test.expect(second._tag).toBe("Failure")

      const ref = (
        memoMap as unknown as {
          ref: SynchronizedRef.SynchronizedRef<Map<unknown, unknown>>
        }
      ).ref
      const map = yield* SynchronizedRef.get(ref)
      test.expect(map.has(failingLayer)).toBe(true)
    }).pipe(Effect.scoped, Effect.runPromise),
  )
})

class Logger extends Context.Tag("Logger")<
  Logger,
  { log: (msg: string) => Effect.Effect<void> }
>() {}
class Database extends Context.Tag("Database")<
  Database,
  { query: (sql: string) => Effect.Effect<unknown> }
>() {}
class UserRepo extends Context.Tag("UserRepo")<
  UserRepo,
  { findUser: (id: string) => Effect.Effect<unknown> }
>() {}
class ExternalApi extends Context.Tag("ExternalApi")<
  ExternalApi,
  { call: () => Effect.Effect<void> }
>() {}

const LoggerLive = Layer.succeed(Logger, {
  log: (msg) => Effect.log(msg),
})

const DatabaseLive = Layer.effect(
  Database,
  Effect.gen(function* () {
    const logger = yield* Logger
    yield* logger.log("Connecting to database...")
    return { query: (sql) => Effect.succeed({ rows: [] }) }
  }),
)

const UserRepoLive = Layer.effect(
  UserRepo,
  Effect.gen(function* () {
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
