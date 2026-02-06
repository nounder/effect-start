import * as test from "bun:test"
import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Option from "effect/Option"
import * as BunServer from "./bun/BunServer.ts"
import * as Route from "./Route.ts"
import * as Start from "./Start.ts"

test.describe(Start.pack, () => {
  test.test("should resolve internal dependencies automatically", async () => {
    const AppLayer = Start.pack(
      UserRepoLive,
      DatabaseLive,
      LoggerLive,
    )

    test
      .expectTypeOf<Layer.Layer.Context<typeof AppLayer>>()
      .toEqualTypeOf<ExternalApi>()

    const ExternalApiLive = Layer.succeed(ExternalApi, {
      call: () => Effect.void,
    })

    const program = Effect.gen(function*() {
      const userRepo = yield* UserRepo
      const result = yield* userRepo.findUser("123")
      return result
    })

    const result = await Effect.runPromise(
      program.pipe(Effect.provide(AppLayer), Effect.provide(ExternalApiLive)),
    )

    test.expect(result).toEqual({ rows: [] })
  })

  test.test("should require services not in the pack", async () => {
    const PartialPack = Start.pack(UserRepoLive, DatabaseLive)

    test
      .expectTypeOf<Layer.Layer.Context<typeof PartialPack>>()
      .toEqualTypeOf<Logger | ExternalApi>()
  })

  test.test("should work with dependents-first order", async () => {
    const AppLayer = Start.pack(
      UserRepoLive,
      DatabaseLive,
      LoggerLive,
    )

    const ExternalApiLive = Layer.succeed(ExternalApi, {
      call: () => Effect.void,
    })

    const program = Effect.gen(function*() {
      const userRepo = yield* UserRepo
      const result = yield* userRepo.findUser("456")
      return result
    })

    const result = await Effect.runPromise(
      program.pipe(Effect.provide(AppLayer), Effect.provide(ExternalApiLive)),
    )

    test.expect(result).toEqual({ rows: [] })
  })

  test.test("should allow accessing all provided services", async () => {
    const AppLayer = Start.pack(
      UserRepoLive,
      DatabaseLive,
      LoggerLive,
    )

    const ExternalApiLive = Layer.succeed(ExternalApi, {
      call: () => Effect.void,
    })

    const program = Effect.gen(function*() {
      yield* UserRepo
      yield* Database
      const logger = yield* Logger
      yield* logger.log("All services available!")
      return "success"
    })

    const result = await Effect.runPromise(
      program.pipe(Effect.provide(AppLayer), Effect.provide(ExternalApiLive)),
    )

    test.expect(result).toEqual("success")
  })

  test.test("should memoize layers (build each only once)", async () => {
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
        return { query: (sql) => Effect.succeed({ rows: [] }) }
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

    const AppLayer = Start.pack(
      UserRepoLiveWithCounter,
      DatabaseLiveWithCounter,
      LoggerLiveWithCounter,
    )

    const program = Effect.gen(function*() {
      yield* UserRepo
      yield* Database
      yield* Logger
      return "done"
    })

    await Effect.runPromise(program.pipe(Effect.provide(AppLayer)))

    test.expect(loggerBuildCount).toEqual(1)
    test.expect(databaseBuildCount).toEqual(1)
  })
})

test.describe(Start.layer, () => {
  const layerWithDefault = Layer.scoped(
    BunServer.BunServer,
    Effect.gen(function*() {
      const existing = yield* Effect.serviceOption(BunServer.BunServer)
      if (Option.isSome(existing)) {
        return existing.value
      }
      return yield* BunServer.make({ port: 0 })
    }),
  )

  const testCompose = (appLayer: Layer.Layer<any, any, any>) =>
    layerWithDefault.pipe(
      Layer.provide(appLayer),
    ) as Layer.Layer<BunServer.BunServer>

  const customPort = 49152 + Math.floor(Math.random() * 1000)

  test.test("user-provided BunServer takes precedence", async () => {
    const routes = Route.tree({
      "/": Route.get(Route.text("hello")),
    })

    const appLayer = Start.pack(
      BunServer.layer({ port: customPort }),
      Route.layer(routes),
    )

    const composed = testCompose(appLayer)

    const port = await Effect.runPromise(
      Effect.scoped(
        Effect
          .gen(function*() {
            const bunServer = yield* BunServer.BunServer
            return bunServer.server.port
          })
          .pipe(Effect.provide(composed)),
      ),
    )

    test.expect(port).toBe(customPort)
  })

  test.test("user-provided BunServer serves routes", async () => {
    const routes = Route.tree({
      "/": Route.get(Route.text("custom-server")),
    })

    const appLayer = Start.pack(
      BunServer.layer({ port: customPort }),
      Route.layer(routes),
    )

    const composed = testCompose(appLayer)

    const [status, body, port] = await Effect.runPromise(
      Effect.scoped(
        Effect
          .gen(function*() {
            const bunServer = yield* BunServer.BunServer
            const response = yield* Effect.promise(() =>
              fetch(`http://localhost:${bunServer.server.port}/`)
            )
            return [
              response.status,
              yield* Effect.promise(() => response.text()),
              bunServer.server.port,
            ] as const
          })
          .pipe(Effect.provide(composed)),
      ),
    )

    test.expect(port).toBe(customPort)
    test.expect(status).toBe(200)
    test.expect(body).toBe("custom-server")
  })

  test.test("default BunServer is used when not provided", async () => {
    const routes = Route.tree({
      "/": Route.get(Route.text("default-server")),
    })

    const appLayer = Start.layer(
      Route.layer(routes),
    )

    const composed = testCompose(appLayer)

    const [status, body] = await Effect.runPromise(
      Effect.scoped(
        Effect
          .gen(function*() {
            const bunServer = yield* BunServer.BunServer
            const response = yield* Effect.promise(() =>
              fetch(`http://localhost:${bunServer.server.port}/`)
            )
            return [
              response.status,
              yield* Effect.promise(() => response.text()),
            ] as const
          })
          .pipe(Effect.provide(composed)),
      ),
    )

    test.expect(status).toBe(200)
    test.expect(body).toBe("default-server")
  })
})

// --- Test services for Start.pack tests ---

class Logger
  extends Context.Tag("Logger")<
    Logger,
    { log: (msg: string) => Effect.Effect<void> }
  >()
{}
class Database
  extends Context.Tag("Database")<
    Database,
    { query: (sql: string) => Effect.Effect<unknown> }
  >()
{}
class UserRepo
  extends Context.Tag("UserRepo")<
    UserRepo,
    { findUser: (id: string) => Effect.Effect<unknown> }
  >()
{}
class ExternalApi
  extends Context.Tag("ExternalApi")<
    ExternalApi,
    { call: () => Effect.Effect<void> }
  >()
{}

const LoggerLive = Layer.succeed(Logger, {
  log: (msg) => Effect.log(msg),
})

const DatabaseLive = Layer.effect(
  Database,
  Effect.gen(function*() {
    const logger = yield* Logger
    yield* logger.log("Connecting to database...")
    return { query: (sql) => Effect.succeed({ rows: [] }) }
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
