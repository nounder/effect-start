import * as test from "bun:test"
import * as Context from "effect/Context"
import * as Deferred from "effect/Deferred"
import * as Effect from "effect/Effect"
import * as Fiber from "effect/Fiber"
import * as Layer from "effect/Layer"
import { BunServer } from "effect-start/bun"
import * as Start from "effect-start/Start"
import * as StartApp from "../src/internal/StartApp.ts"

// Start.build and Start.pack are thin wrappers over LayerExtra.provideMergeAll
// and LayerExtra.buildUnordered (see test/internal/LayerExtra.test.ts for
// runtime behavior coverage). The tests here only validate the parts that
// differ from the underlying functions: the re-declared signatures.

test.describe(Start.build, () => {
  test.test("type signature: rejects wrong layer ordering", () => {
    // @ts-expect-error LoggerLive first means DatabaseLive can't find Logger
    Start.build(LoggerLive, DatabaseLive, UserRepoLive)

    // @ts-expect-error DatabaseLive before LoggerLive, UserRepoLive last but needs Database
    Start.build(DatabaseLive, LoggerLive, UserRepoLive)
  })

  test.test("type signature: surfaces unsatisfied dependencies on R", () => {
    const AppLayer = Start.build(UserRepoLive, DatabaseLive, LoggerLive)
    test.expectTypeOf<Layer.Layer.Context<typeof AppLayer>>().toEqualTypeOf<ExternalApi>()
  })

  test.test("smoke: produces a working layer", () => {
    const AppLayer = Start.build(UserRepoLive, DatabaseLive, LoggerLive)
    const ExternalApiLive = Layer.succeed(ExternalApi, { call: () => Effect.void })

    return Effect.gen(function* () {
      const userRepo = yield* UserRepo
      const result = yield* userRepo.findUser("123")
      test.expect(result).toEqual({ rows: [] })
    }).pipe(Effect.provide(AppLayer), Effect.provide(ExternalApiLive), Effect.runPromise)
  })
})

test.describe(Start.pack, () => {
  test.test("type signature: surfaces unsatisfied dependencies on R", () => {
    const AppLayer = Start.pack(LoggerLive, DatabaseLive, UserRepoLive)
    test.expectTypeOf<Layer.Layer.Context<typeof AppLayer>>().toEqualTypeOf<ExternalApi>()
  })

  test.test("smoke: produces a working layer regardless of order", () => {
    const AppLayer = Start.pack(LoggerLive, DatabaseLive, UserRepoLive)
    const ExternalApiLive = Layer.succeed(ExternalApi, { call: () => Effect.void })

    return Effect.gen(function* () {
      const userRepo = yield* UserRepo
      const result = yield* userRepo.findUser("123")
      test.expect(result).toEqual({ rows: [] })
    }).pipe(Effect.provide(AppLayer), Effect.provide(ExternalApiLive), Effect.runPromise)
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

const LoggerLive = Layer.succeed(Logger, { log: (msg) => Effect.log(msg) })

const DatabaseLive = Layer.effect(
  Database,
  Effect.gen(function* () {
    const logger = yield* Logger
    yield* logger.log("Connecting to database...")
    return { query: (_sql) => Effect.succeed({ rows: [] }) }
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
    return { findUser: (id) => db.query(`SELECT * FROM users WHERE id = ${id}`) }
  }),
)
