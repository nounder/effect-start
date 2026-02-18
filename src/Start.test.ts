import * as test from "bun:test"
import * as Context from "effect/Context"
import * as Deferred from "effect/Deferred"
import * as Effect from "effect/Effect"
import * as Fiber from "effect/Fiber"
import * as Layer from "effect/Layer"
import * as Option from "effect/Option"
import * as BunServer from "./bun/BunServer.ts"
import * as Route from "./Route.ts"
import * as Start from "./Start.ts"
import * as StartApp from "./StartApp.ts"

test.describe(Start.pack, () => {
  test.test("should resolve internal dependencies automatically", () => {
    const AppLayer = Start.pack(UserRepoLive, DatabaseLive, LoggerLive)

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
    const PartialPack = Start.pack(UserRepoLive, DatabaseLive)

    test
      .expectTypeOf<Layer.Layer.Context<typeof PartialPack>>()
      .toEqualTypeOf<Logger | ExternalApi>()
  })

  test.test("should reject wrong layer ordering", () => {
    // @ts-expect-error LoggerLive first means DatabaseLive can't find Logger
    Start.pack(LoggerLive, DatabaseLive, UserRepoLive)

    // @ts-expect-error DatabaseLive before LoggerLive, UserRepoLive last but needs Database
    Start.pack(DatabaseLive, LoggerLive, UserRepoLive)
  })

  test.test("should work with dependents-first order", () => {
    const AppLayer = Start.pack(UserRepoLive, DatabaseLive, LoggerLive)

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
    const AppLayer = Start.pack(UserRepoLive, DatabaseLive, LoggerLive)

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

    const AppLayer = Start.pack(
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

test.describe(Start.layer, () => {
  const layerWithDefault = Layer.scoped(
    BunServer.BunServer,
    Effect.gen(function* () {
      const existing = yield* Effect.serviceOption(BunServer.BunServer)
      if (Option.isSome(existing)) {
        return existing.value
      }
      const routes = yield* Route.Routes
      return yield* BunServer.make({ port: 0 }, routes)
    }),
  )

  const testCompose = (appLayer: Layer.Layer<any, any, any>) =>
    layerWithDefault.pipe(Layer.provide(appLayer)) as Layer.Layer<BunServer.BunServer>

  const customPort = 49152 + Math.floor(Math.random() * 1000)

  test.test("user-provided BunServer takes precedence", () => {
    const routes = Route.tree({
      "/": Route.get(Route.text("hello")),
    })

    const appLayer = Start.pack(BunServer.layerRoutes({ port: customPort }), Route.layer(routes))

    const composed = testCompose(appLayer)

    return Effect.gen(function* () {
      const bunServer = yield* BunServer.BunServer

      test.expect(bunServer.server.port).toBe(customPort)
    }).pipe(Effect.provide(composed), Effect.scoped, Effect.runPromise)
  })

  test.test("user-provided BunServer serves routes", () => {
    const routes = Route.tree({
      "/": Route.get(Route.text("custom-server")),
    })

    const appLayer = Start.pack(BunServer.layerRoutes({ port: customPort }), Route.layer(routes))

    const composed = testCompose(appLayer)

    return Effect.gen(function* () {
      const bunServer = yield* BunServer.BunServer
      const response = yield* Effect.promise(() =>
        fetch(`http://localhost:${bunServer.server.port}/`),
      )
      const body = yield* Effect.promise(() => response.text())

      test.expect(bunServer.server.port).toBe(customPort)
      test.expect(response.status).toBe(200)
      test.expect(body).toBe("custom-server")
    }).pipe(Effect.provide(composed), Effect.scoped, Effect.runPromise)
  })

  test.test("default BunServer is used when not provided", () => {
    const routes = Route.tree({
      "/": Route.get(Route.text("default-server")),
    })

    const appLayer = Start.layer(Route.layer(routes))

    const composed = testCompose(appLayer)

    return Effect.gen(function* () {
      const bunServer = yield* BunServer.BunServer
      const response = yield* Effect.promise(() =>
        fetch(`http://localhost:${bunServer.server.port}/`),
      )
      const body = yield* Effect.promise(() => response.text())

      test.expect(response.status).toBe(200)
      test.expect(body).toBe("default-server")
    }).pipe(Effect.provide(composed), Effect.scoped, Effect.runPromise)
  })
})

test.describe(Start.build, () => {
  test.test("should resolve dependencies in any order", () => {
    const AppLayer = Start.build(LoggerLive, DatabaseLive, UserRepoLive)

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
    const AppLayer = Start.build(UserRepoLive, DatabaseLive, LoggerLive)

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
    const PartialPack = Start.build(UserRepoLive, DatabaseLive)

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

    const AppLayer = Start.build(
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
})

// --- Test services for Start.pack tests ---

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
