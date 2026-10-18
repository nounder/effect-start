import * as test from "bun:test"
import { BunServer } from "effect-start/bun"
import * as Route from "effect-start/Route"
import * as RouteHttp from "effect-start/RouteHttp"
import * as Start from "effect-start/Start"
import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as HttpEffect from "effect/http/HttpEffect"
import * as HttpRouter from "effect/http/HttpRouter"
import * as HttpServer from "effect/http/HttpServer"
import * as HttpServerRequest from "effect/http/HttpServerRequest"
import * as HttpServerResponse from "effect/http/HttpServerResponse"
import * as Layer from "effect/Layer"
import * as NetAddress from "effect/net/NetAddress"
import * as Schema from "effect/Schema"
import type * as Scope from "effect/Scope"
import * as TestHttpClient from "./internal/TestHttpClient.ts"

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
      .expectTypeOf<Layer.Services<typeof AppLayer>>()
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
  test.it("accumulates independent route layers in either order without duplicating handlers", () =>
    Effect
      .gen(function*() {
        const first = Route.layerMerge({
          "/first": Route.get(Route.text("first")),
          "/shared": Route.get(Route.text("get")),
        })
        const second = Route.layerMerge({
          "/second": Route.get(Route.text("second")),
          "/shared": Route.post(Route.text("post")),
        })

        for (const layers of [[first, second], [second, first]] as const) {
          const context = yield* Layer.build(
            RouteHttp.layerRouter().pipe(Layer.provideMerge(Start.pack(...layers))),
          )
          const routes = Context.get(context, Route.Routes)
          const router = Context.get(context, HttpRouter.HttpRouter)
          const client = TestHttpClient.fromHandler(HttpEffect.toWebHandler(router.asHttpEffect()))

          test
            .expect(Object.keys(routes).sort())
            .toEqual(["/first", "/second", "/shared"])
          test
            .expect(routes["/shared"])
            .toHaveLength(2)

          for (const path of ["/first", "/second"] as const) {
            const response = yield* client.get(`http://localhost${path}`)

            test
              .expect(yield* response.text)
              .toBe(path.slice(1))
          }

          const get = yield* client.get("http://localhost/shared")
          const post = yield* client.post("http://localhost/shared")

          test
            .expect(yield* get.text)
            .toBe("get")
          test
            .expect(yield* post.text)
            .toBe("post")
        }
      })
      .pipe(
        Effect.scoped,
        Effect.runPromise,
      ))

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
      .expectTypeOf<Layer.Services<typeof AppLayer>>()
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

test.describe(RouteHttp.layer, () => {
  test.it("serves through a custom HttpServer and reuses an existing HttpRouter", () =>
    Effect
      .gen(function*() {
        let handler: ReturnType<typeof HttpEffect.toWebHandler> | undefined
        const server = HttpServer.make({
          address: NetAddress.inetAddressFromIpStringUnsafe("127.0.0.1", 0),
          serve: (app) =>
            Effect.gen(function*() {
              const context = yield* Effect.context<never>()
              handler = HttpEffect.toWebHandlerWith<
                never,
                HttpServerRequest.HttpServerRequest | Scope.Scope
              >(context)(app)
            }),
        })
        const router = yield* HttpRouter.make
        yield* router.add("GET", "/hello", HttpServerResponse.text("world"))
        const context = yield* Layer.build(
          RouteHttp.layer().pipe(
            Layer.provide(Layer.succeed(HttpServer.HttpServer, server)),
            Layer.provide(Layer.succeed(HttpRouter.HttpRouter, router)),
            Layer.provide(Route.layer({})),
          ),
        )
        const client = TestHttpClient.fromHandler(handler!)
        const response = yield* client.get("http://localhost/hello")

        test
          .expect(Context.get(context, HttpRouter.HttpRouter))
          .toBe(router)
        test
          .expect(response.status)
          .toBe(200)
        test
          .expect(yield* response.text)
          .toBe("world")
      })
      .pipe(
        Effect.scoped,
        Effect.runPromise,
      ))

  test.it(
    "applies middleware in registration order to RouteMap and HttpRouter routes",
    () =>
      Effect
        .gen(function*() {
          const events: Array<string> = []
          let registeredRouter: HttpRouter.HttpRouter | undefined
          const application = Layer
            .effectDiscard(Effect.gen(function*() {
              const router = yield* HttpRouter.HttpRouter
              registeredRouter = router
              for (const name of ["first", "second"]) {
                yield* router.addGlobalMiddleware((next) =>
                  Effect.gen(function*() {
                    const request = yield* HttpServerRequest.HttpServerRequest
                    events.push(`${name}:before:${request.method}`)
                    return yield* next.pipe(
                      Effect.map((response) =>
                        HttpServerResponse.setHeader(
                          response,
                          "x-order",
                          `${name}(${response.headers["x-order"] ?? "handler"})`,
                        )
                      ),
                      Effect.ensuring(Effect.sync(() => {
                        events.push(`${name}:after`)
                      })),
                    )
                  })
                )
              }
              yield* router.add("GET", "/external", HttpServerResponse.text("external"))
            }))
            .pipe(
              Layer.provideMerge(
                RouteHttp.layer().pipe(
                  Layer.provideMerge(BunServer.layer({ hostname: "localhost", port: 0 })),
                ),
              ),
              Layer.provideMerge(Route.layer({
                "/": Route.get(Route.text("home")),
                "/users/:id": Route.get(
                  Route.schemaPathParams({ id: Schema.String }),
                  Route.text(function*(ctx) {
                    return ctx.pathParams.id
                  }),
                ),
              })),
            )
          const context = yield* Layer.build(application)
          const address = HttpServer.formatAddress(Context.get(context, HttpServer.HttpServer).address)
          const client = TestHttpClient.fromHandler((request) => fetch(request))

          test
            .expect(Context.get(context, HttpRouter.HttpRouter))
            .toBe(registeredRouter!)
          test
            .expect(Object.keys(Context.get(context, Route.Routes)))
            .toEqual(["/", "/users/:id"])

          for (const path of ["/", "/users/42", "/external"]) {
            events.length = 0
            const response = yield* client.get(address + path)

            test
              .expect(response.status)
              .toBe(200)
            test
              .expect(response.headers["x-order"])
              .toBe("first(second(handler))")
            test
              .expect(yield* response.text)
              .toBe(path === "/" ? "home" : path === "/external" ? "external" : "42")
            test
              .expect(events)
              .toEqual(["first:before:GET", "second:before:GET", "second:after", "first:after"])
          }

          for (const method of ["head", "options", "post"] as const) {
            events.length = 0
            const response = yield* client[method](address + "/")

            test
              .expect(response.status)
              .toBe(method === "head" ? 200 : method === "options" ? 204 : 405)
            test
              .expect(response.headers["x-order"])
              .toBe("first(second(handler))")
            test
              .expect(events)
              .toEqual([
                `first:before:${method.toUpperCase()}`,
                `second:before:${method.toUpperCase()}`,
                "second:after",
                "first:after",
              ])

            yield* response.text
          }

          events.length = 0

          test
            .expect((yield* client.get(address + "/missing")).status)
            .toBe(404)
          test
            .expect(events)
            .toEqual(["first:before:GET", "second:before:GET", "second:after", "first:after"])
        })
        .pipe(
          Effect.scoped,
          Effect.runPromise,
        ),
  )

  test.it(
    "allows middleware added after startup to short-circuit routing",
    () =>
      Effect
        .gen(function*() {
          let handled = 0
          const context = yield* Layer.build(
            RouteHttp.layer().pipe(
              Layer.provideMerge(BunServer.layer({ hostname: "localhost", port: 0 })),
              Layer.provide(Route.layer({
                "/": Route.get(Route.text(function*() {
                  handled++
                  return "home"
                })),
              })),
            ),
          )
          const address = HttpServer.formatAddress(Context.get(context, HttpServer.HttpServer).address)
          const client = TestHttpClient.fromHandler((request) => fetch(request))
          const router = Context.get(context, HttpRouter.HttpRouter)

          test
            .expect(yield* (yield* client.get(address)).text)
            .toBe("home")
          test
            .expect(handled)
            .toBe(1)

          yield* router.addGlobalMiddleware((next) =>
            HttpServerRequest.HttpServerRequest.use((request) =>
              request.headers["x-block"] === "true"
                ? Effect.succeed(
                  HttpServerResponse.text("blocked", { status: 403, headers: { "x-middleware": "blocked" } }),
                )
                : Effect.map(next, (response) => HttpServerResponse.setHeader(response, "x-middleware", "allowed"))
            )
          )

          for (const path of ["/", "/missing"]) {
            const response = yield* client.get(address + path, { headers: { "x-block": "true" } })

            test
              .expect(response.status)
              .toBe(403)
            test
              .expect(response.headers["x-middleware"])
              .toBe("blocked")
            test
              .expect(yield* response.text)
              .toBe("blocked")
          }

          test
            .expect(handled)
            .toBe(1)

          const allowed = yield* client.get(address)

          test
            .expect(allowed.status)
            .toBe(200)
          test
            .expect(allowed.headers["x-middleware"])
            .toBe("allowed")
          test
            .expect(yield* allowed.text)
            .toBe("home")
          test
            .expect(handled)
            .toBe(2)
        })
        .pipe(
          Effect.scoped,
          Effect.runPromise,
        ),
  )
})

class Logger extends Context.Service<Logger, {
  log: (msg: string) => Effect.Effect<void>
}>()("Logger") {}
class Database extends Context.Service<Database, {
  query: (sql: string) => Effect.Effect<unknown>
}>()("Database") {}
class UserRepo extends Context.Service<UserRepo, {
  findUser: (id: string) => Effect.Effect<unknown>
}>()("UserRepo") {}
class ExternalApi extends Context.Service<ExternalApi, {
  call: () => Effect.Effect<void>
}>()("ExternalApi") {}

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
