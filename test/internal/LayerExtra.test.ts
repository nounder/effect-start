import * as test from "bun:test"
import * as Cause from "effect/Cause"
import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Exit from "effect/Exit"
import * as Layer from "effect/Layer"
import * as LayerExtra from "effect-start/internal/LayerExtra"

class Logger extends Context.Service<Logger, {
  log: (msg: string) => Effect.Effect<void>
}>()("LayerExtra.test.Logger") {}
class Database extends Context.Service<Database, {
  query: (sql: string) => Effect.Effect<unknown>
}>()("LayerExtra.test.Database") {}
class UserRepo extends Context.Service<UserRepo, {
  findUser: (id: string) => Effect.Effect<unknown>
}>()("LayerExtra.test.UserRepo") {}
class ExternalApi extends Context.Service<ExternalApi, {
  call: () => Effect.Effect<void>
}>()("LayerExtra.test.ExternalApi") {}

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
    const AppLayer = Layer.effectContext(
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
    const AppLayer = Layer.effectContext(
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

  test.test("memoizes nested layers across successful builds", () => {
    let loggerBuildCount = 0

    const LoggerLiveWithCounter = Layer.effect(
      Logger,
      Effect.sync(() => {
        loggerBuildCount++
        return { log: (msg) => Effect.log(msg) }
      }),
    )

    const DatabaseLiveWithCounter = Layer
      .effect(
        Database,
        Effect.gen(function*() {
          yield* Logger
          return { query: (_sql) => Effect.succeed({ rows: [] }) }
        }),
      )
      .pipe(Layer.provide(LoggerLiveWithCounter))

    const UserRepoLiveWithCounter = Layer
      .effect(
        UserRepo,
        Effect.gen(function*() {
          yield* Logger
          return {
            findUser: (_id) => Effect.succeed({ rows: [] }),
          }
        }),
      )
      .pipe(Layer.provide(LoggerLiveWithCounter))

    const AppLayer = Layer.effectContext(
      LayerExtra.buildUnordered([
        DatabaseLiveWithCounter,
        UserRepoLiveWithCounter,
      ]),
    )

    return Effect
      .gen(function*() {
        yield* Database
        yield* UserRepo

        test
          .expect(loggerBuildCount)
          .toEqual(1)
      })
      .pipe(
        Effect.provide(AppLayer),
        Effect.runPromise,
      )
  })

  test.test("releases failed speculative acquisitions before retrying", () => {
    class Dependency extends Context.Service<Dependency, {}>()("LayerExtra.test.Dependency") {}
    class Resource extends Context.Service<Resource, {}>()("LayerExtra.test.Resource") {}

    const events: Array<string> = []
    const ResourceLive = Layer.effect(
      Resource,
      Effect.gen(function*() {
        yield* Effect.acquireRelease(
          Effect.sync(() => events.push("acquire")),
          () => Effect.sync(() => events.push("release")),
        )
        yield* Dependency
        return {}
      }),
    )
    const DependencyLive = Layer.succeed(Dependency, {})
    const AppLayer = Layer.effectContext(
      LayerExtra.buildUnordered([ResourceLive, DependencyLive]),
    )

    return Effect
      .gen(function*() {
        yield* Resource

        test
          .expect(events)
          .toEqual(["acquire", "release", "acquire"])
      })
      .pipe(
        Effect.provide(AppLayer),
        Effect.tap(() =>
          Effect.sync(() => {
            test
              .expect(events)
              .toEqual(["acquire", "release", "acquire", "release"])
          })
        ),
        Effect.runPromise,
      )
  })

  test.test("preserves acquisition failures when no layer can progress", () => {
    const FailingLive = Layer.effect(
      Logger,
      Effect.fail("build failed" as const),
    )
    const AppLayer = Layer.effectContext(
      LayerExtra.buildUnordered([FailingLive]),
    )

    return Layer
      .build(AppLayer)
      .pipe(
        Effect.scoped,
        Effect.flip,
        Effect.tap((error) =>
          Effect.sync(() => {
            test
              .expect(error)
              .toBe("build failed")
          })
        ),
        Effect.runPromise,
      )
  })

  test.test("does not retry or suppress acquisition failures when another layer progresses", () => {
    let attempts = 0
    const FailingOnceLive = Layer.effect(
      Logger,
      Effect.suspend(() => {
        attempts++
        return attempts === 1
          ? Effect.fail("build failed" as const)
          : Effect.succeed({ log: (_msg: string) => Effect.void })
      }),
    )
    const AppLayer = Layer.effectContext(
      LayerExtra.buildUnordered([FailingOnceLive, ExternalApiLive]),
    )

    return Effect
      .gen(function*() {
        const exit = yield* Layer.build(AppLayer).pipe(
          Effect.scoped,
          Effect.exit,
        )

        test
          .expect(attempts)
          .toBe(1)
        test
          .expect(exit)
          .toEqual(Exit.fail("build failed"))
      })
      .pipe(Effect.runPromise)
  })

  test.test("does not retry non-service defects when another layer progresses", () => {
    let attempts = 0
    const defect = new Error("Service not found accidentally")
    const DefectiveLive = Layer.effect(
      Logger,
      Effect.suspend(() => {
        attempts++
        return attempts === 1
          ? Effect.die(defect)
          : Effect.succeed({ log: (_msg: string) => Effect.void })
      }),
    )
    const AppLayer = Layer.effectContext(
      LayerExtra.buildUnordered([DefectiveLive, ExternalApiLive]),
    )

    return Effect
      .gen(function*() {
        const exit = yield* Layer.build(AppLayer).pipe(
          Effect.scoped,
          Effect.exit,
        )

        test
          .expect(attempts)
          .toBe(1)
        test
          .expect(
            Exit.isFailure(exit) && exit.cause.reasons.some(
              (reason) => Cause.isDieReason(reason) && reason.defect === defect,
            ),
          )
          .toBe(true)
      })
      .pipe(Effect.runPromise)
  })

  test.test("rejects duplicate service providers", () => {
    const FirstLoggerLive = Layer.succeed(Logger, { log: (_msg: string) => Effect.void })
    const SecondLoggerLive = Layer.succeed(Logger, { log: (_msg: string) => Effect.void })
    const AppLayer = Layer.effectContext(
      LayerExtra.buildUnordered([FirstLoggerLive, SecondLoggerLive]),
    )

    return Effect
      .gen(function*() {
        const exit = yield* Layer.build(AppLayer).pipe(
          Effect.scoped,
          Effect.exit,
        )

        test
          .expect(
            Exit.isFailure(exit) && exit.cause.reasons.some(
              (reason) =>
                Cause.isDieReason(reason) &&
                String(reason.defect).includes("multiple layers providing service: LayerExtra.test.Logger"),
            ),
          )
          .toBe(true)
      })
      .pipe(Effect.runPromise)
  })

  test.test("accepts repeated exposure of the same service instance", () => {
    const logger = { log: (_msg: string) => Effect.void }
    const AppLayer = Layer.effectContext(
      LayerExtra.buildUnordered([
        Layer.succeed(Logger, logger),
        Layer.succeed(Logger, logger),
      ]),
    )

    return Effect
      .gen(function*() {
        const context = yield* Layer.build(AppLayer).pipe(Effect.scoped)

        test
          .expect(Context.get(context, Logger))
          .toBe(logger)
      })
      .pipe(Effect.runPromise)
  })

  test.test("reports every missing service in a cyclic graph", () => {
    class First extends Context.Service<First, {}>()("LayerExtra.test.First") {}
    class Second extends Context.Service<Second, {}>()("LayerExtra.test.Second") {}

    const FirstLive = Layer.effect(
      First,
      Effect.gen(function*() {
        yield* Second
        return {}
      }),
    )
    const SecondLive = Layer.effect(
      Second,
      Effect.gen(function*() {
        yield* First
        return {}
      }),
    )
    const AppLayer = Layer.effectContext(
      LayerExtra.buildUnordered([FirstLive, SecondLive]),
    )

    return Effect
      .gen(function*() {
        const exit = yield* Layer.build(AppLayer).pipe(
          Effect.scoped,
          Effect.exit,
        )

        test
          .expect(Exit.isFailure(exit))
          .toBe(true)

        if (Exit.isFailure(exit)) {
          const defects = exit.cause.reasons.filter(Cause.isDieReason)

          test
            .expect(defects)
            .toHaveLength(2)

          const messages = defects.map((reason) => String(reason.defect))

          test
            .expect(messages.some((message) => message.includes("LayerExtra.test.First")))
            .toBe(true)
          test
            .expect(messages.some((message) => message.includes("LayerExtra.test.Second")))
            .toBe(true)
        }
      })
      .pipe(Effect.runPromise)
  })
})
