import * as test from "bun:test"
import * as Route from "effect-start/Route"
import * as Start from "effect-start/Start"
import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"

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

    test
      .expectTypeOf<Layer.Layer.Context<typeof AppLayer>>()
      .toEqualTypeOf<
        ExternalApi
      >()
  })

  test.test("smoke: produces a working layer", () => {
    const AppLayer = Start.build(UserRepoLive, DatabaseLive, LoggerLive)
    const ExternalApiLive = Layer.succeed(ExternalApi, {
      call: () => Effect.void,
    })

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
})

test.describe(Start.pack, () => {
  test.test("type signature: rejects unsatisfied dependencies", () => {
    // @ts-expect-error UserRepoLive needs ExternalApi which no layer provides
    Start.pack(LoggerLive, DatabaseLive, UserRepoLive)
  })

  test.test("type signature: error scopes to the argument with the missing dep", () => {
    Start.pack(
      LoggerLive,
      DatabaseLive,
      // @ts-expect-error only this argument should be flagged — its R has unsatisfied ExternalApi
      UserRepoLive,
    )
  })

  test.test("type signature: a layer with no missing deps is not flagged", () => {
    // DatabaseLive needs Logger which IS provided, so it should not error here.
    // UserRepoLive needs ExternalApi which is NOT provided, so it errors instead.
    Start.pack(
      LoggerLive,
      DatabaseLive,
      // @ts-expect-error UserRepoLive is the only arg with an unsatisfied dep
      UserRepoLive,
    )
  })

  test.test("type signature: returns Layer with R = never when fully satisfied", () => {
    const ExternalApiLive = Layer.succeed(ExternalApi, {
      call: () => Effect.void,
    })
    const AppLayer = Start.pack(
      LoggerLive,
      DatabaseLive,
      UserRepoLive,
      ExternalApiLive,
    )

    test
      .expectTypeOf<Layer.Layer.Context<typeof AppLayer>>()
      .toEqualTypeOf<
        never
      >()
  })

  test.test("type signature: a layer with partial satisfaction is still flagged", () => {
    // PartialNeedsLive needs Logger (satisfied) AND ExternalApi (unsatisfied) —
    // the error should still flag this argument.
    const PartialNeedsLive = Layer.effect(
      UserRepo,
      Effect.gen(function*() {
        yield* Logger
        yield* ExternalApi
        return { findUser: () => Effect.succeed(null) }
      }),
    )
    Start.pack(
      LoggerLive,
      // @ts-expect-error ExternalApi unsatisfied; Logger is satisfied and should not appear in the error
      PartialNeedsLive,
    )
  })

  test.test("smoke: produces a working layer regardless of order", () => {
    const ExternalApiLive = Layer.succeed(ExternalApi, {
      call: () => Effect.void,
    })
    const AppLayer = Start.pack(
      LoggerLive,
      DatabaseLive,
      UserRepoLive,
      ExternalApiLive,
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
        Effect.runPromise,
      )
  })
})

test.describe("Start.export", () => {
  test.test("routes a matching request", async () => {
    const fetch = await Start.export(
      Route.layer({
        "/hello": Route.get(Route.text("hello world")),
      }),
    )

    const response = await fetch(new Request("http://localhost/hello"))

    test.expect(response.status).toBe(200)
    test.expect(await response.text()).toBe("hello world")
  })

  test.test("returns 404 for an unmatched path", async () => {
    const fetch = await Start.export(
      Route.layer({
        "/hello": Route.get(Route.text("hello world")),
      }),
    )

    const response = await fetch(new Request("http://localhost/missing"))

    test.expect(response.status).toBe(404)
  })

  test.test("resolves services from layers regardless of order, like pack", async () => {
    class Config extends Context.Tag("Config")<Config, { readonly name: string }>() {}
    class Greeter extends Context.Tag("Greeter")<
      Greeter,
      { readonly greet: () => Effect.Effect<string> }
    >() {}

    const GreeterLive = Layer.effect(
      Greeter,
      Effect.gen(function*() {
        const config = yield* Config
        return { greet: () => Effect.succeed(`hello, ${config.name}`) }
      }),
    )
    const ConfigLive = Layer.succeed(Config, { name: "world" })

    const fetch = await Start.export(
      Route.layer({
        "/greet": Route.get(
          Route.text(function*() {
            const greeter = yield* Greeter
            return yield* greeter.greet()
          }),
        ),
      }),
      // GreeterLive is listed before its dependency ConfigLive, same as pack.
      GreeterLive,
      ConfigLive,
    )

    const response = await fetch(new Request("http://localhost/greet"))

    test.expect(await response.text()).toBe("hello, world")
  })

  test.test("FetchAdapter turns extra fetch arguments into request context", async () => {
    // Services that a FetchAdapter fills in per-request are marked with
    // Route.IntrinsicService so routes can depend on them without a Layer
    // providing them upfront, the same way Route.Request is provided.
    class CloudflareEnv extends Context.Tag("CloudflareEnv")<
      CloudflareEnv,
      { readonly greeting: string }
    >() {
      declare readonly [Route.IntrinsicService]: never
    }

    const fetch = await Start.export(
      Route.layer({
        "/greet": Route.get(
          Route.text(function*() {
            const env = yield* CloudflareEnv
            return env.greeting
          }),
        ),
      }),
      Start.layerFetchAdapter((env: { greeting: string }) => Context.make(CloudflareEnv, env)),
    )

    const response = await fetch(
      new Request("http://localhost/greet"),
      { greeting: "hi from cloudflare" },
    )

    test.expect(await response.text()).toBe("hi from cloudflare")
  })

  test.test("without a FetchAdapter the handler only takes a request", async () => {
    const fetch = await Start.export(
      Route.layer({
        "/hello": Route.get(Route.text("hello world")),
      }),
    )

    test.expect(fetch.length).toBe(1)
  })
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
