import * as HttpServerResponse from "@effect/platform/HttpServerResponse"
import * as t from "bun:test"
import * as Effect from "effect/Effect"
import type * as Types from "effect/Types"
import * as Route from "./Route.ts"
import * as Router from "./Router.ts"
import * as RouteSet from "./RouteSet.ts"

const noopNext: Route.RouteNext = () => Effect.void

class Greeting extends Effect.Tag("Greeting")<Greeting, {
  greet(): string
}>() {}

class Random extends Effect.Tag("Random")<Random, {
  number(): number
  uuid(): string
}>() {}

class AdamError {
  readonly _tag = "AdamError"
}

class EveError {
  readonly _tag = "EveError"
}

t.it("creates router with single route", () => {
  const router = Router.mount(
    "/hello",
    Route.text("Hello World"),
  )

  t.expect(Object.keys(router.mounts)).toHaveLength(1)
  t.expect(router.mounts["/hello"]).toBeDefined()
  t.expect(RouteSet.items(router.mounts["/hello"]!)).toHaveLength(1)

  type Mounts = Router.Router.Mounts<typeof router>
  type HasHelloMount = "/hello" extends keyof Mounts ? true : false
  const _hasMounts: HasHelloMount = true
})

t.it("chains multiple routes", () => {
  const router = Router
    .mount("/hello", Route.text("Hello"))
    .mount("/world", Route.text("World"))

  t.expect(Object.keys(router.mounts)).toHaveLength(2)
  t.expect(router.mounts["/hello"]).toBeDefined()
  t.expect(router.mounts["/world"]).toBeDefined()

  type Mounts = Router.Router.Mounts<typeof router>
  type HasHello = "/hello" extends keyof Mounts ? true : false
  type HasWorld = "/world" extends keyof Mounts ? true : false

  const _hasHello: HasHello = true
  const _hasWorld: HasWorld = true
})

t.it("infers and unions error types from routes", () => {
  const routerSingle = Router.mount(
    "/fail",
    Route.text(Effect.fail(new AdamError())),
  )

  type SingleError = Router.Router.Error<typeof routerSingle>
  type SingleErrorHasAdam = AdamError extends SingleError ? true : false
  const _checkSingle: SingleErrorHasAdam = true

  const routerMultiple = Router
    .mount("/adam", Route.text(Effect.fail(new AdamError())))
    .mount("/eve", Route.text(Effect.fail(new EveError())))

  t.expect(Object.keys(routerMultiple.mounts)).toHaveLength(2)

  type MultipleError = Router.Router.Error<typeof routerMultiple>
  type HasAdam = AdamError extends MultipleError ? true : false
  type HasEve = EveError extends MultipleError ? true : false

  const _hasAdam: HasAdam = true
  const _hasEve: HasEve = true
})

t.it("infers context & error types from HttpMiddleware", () => {
  const httpMiddleware = Route.http((app) =>
    Effect.gen(function*() {
      yield* Random.uuid()
      return yield* Effect.fail(new AdamError())
      return yield* app
    })
  )

  const routerSingle = Router
    .use(httpMiddleware)
    .mount(
      "/",
      Route.text(function*() {
        return yield* Effect.fail(new EveError())
        return "hello"
      }),
    )

  t.expect(Object.keys(routerSingle.mounts)).toHaveLength(1)

  type RouterError = Router.Router.Error<typeof routerSingle>
  type RouterRequirements = Router.Router.Requirements<typeof routerSingle>

  const _errorCheck: AdamError extends RouterError ? true : false = true
  const _errorCheck2: EveError extends RouterError ? true : false = true
  const _requirementsCheck: Random extends RouterRequirements ? true
    : false = true
})

t.it(
  "Router.use with Route.http(HttpServerResponse) infers never types",
  () => {
    const httpMiddleware = Route.http(HttpServerResponse.text("static"))

    const router = Router
      .use(httpMiddleware)
      .mount("/", Route.text("hello"))

    t.expect(Object.keys(router.mounts)).toHaveLength(1)

    type RouterError = Router.Router.Error<typeof router>
    type RouterRequirements = Router.Router.Requirements<typeof router>

    type ErrorIsNever = [RouterError] extends [never] ? true : false
    type RequirementsIsNever = [RouterRequirements] extends [never] ? true : false

    const _checkError: ErrorIsNever = true
    const _checkRequirements: RequirementsIsNever = true
  },
)

t.it("infers and unions context types from routes", () => {
  const routerSingle = Router
    .mount("/uuid", Route.text(Random.uuid()))

  type SingleRequirements = Router.Router.Requirements<typeof routerSingle>
  type SingleHasRandom = Random extends SingleRequirements ? true : false
  const _checkSingle: SingleHasRandom = true

  const routerMultiple = Router
    .mount("/hello", Route.text(Greeting.greet()))
    .mount("/uuid", Route.text(Random.uuid()))

  t.expect(Object.keys(routerMultiple.mounts)).toHaveLength(2)

  type MultipleRequirements = Router.Router.Requirements<typeof routerMultiple>
  type HasGreeting = Greeting extends MultipleRequirements ? true : false
  type HasRandom = Random extends MultipleRequirements ? true : false

  const _hasGreeting: HasGreeting = true
  const _hasRandom: HasRandom = true
})

t.it("merges routes at same path", () => {
  const router = Router
    .mount("/api", Route.get(Route.json({ method: "get" })))
    .mount("/api", Route.post(Route.json({ method: "post" })))

  t.expect(Object.keys(router.mounts)).toHaveLength(1)
  t.expect(router.mounts["/api"]).toBeDefined()
})

t.it("stores routes without modification", () => {
  const wrapperLayer = Route.html(function*(_c, next) {
    const inner = yield* next()
    return `<wrap>${inner}</wrap>`
  })

  const router = Router
    .mount("/page", wrapperLayer.html(Effect.succeed("content")))
    .mount("/uuid", Route.text(Random.uuid()))

  const mountedRoute = router.mounts["/page"]
  t.expect(mountedRoute).toBeDefined()
  t.expect(RouteSet.items(mountedRoute)).toHaveLength(2)

  t.expect(RouteSet.items(mountedRoute)[0].kind).toBe("html")
  t.expect(RouteSet.items(mountedRoute)[1].kind).toBe("html")
})

t.it("HttpMiddleware applies to routes mounted after use()", async () => {
  const httpMiddleware = Route.http((app) => app)

  const router = Router
    .mount("/before", Route.html(Effect.succeed("before-content")))
    .use(httpMiddleware)
    .mount("/after", Route.html(Effect.succeed("after-content")))

  t.expect(Object.keys(router.mounts)).toHaveLength(2)
  t.expect(router.mounts["/before"]).toBeDefined()
  t.expect(router.mounts["/after"]).toBeDefined()
})

t.it("stores multiple routes in order", () => {
  const outerLayer = Route.html(function*(_c, next) {
    const inner = yield* next()
    return `<outer>${inner}</outer>`
  })

  const router = Router
    .mount(
      "/page",
      outerLayer
        .html(function*(_c, next) {
          const inner = yield* next()
          return `<inner>${inner}</inner>`
        })
        .html(Effect.succeed("content")),
    )

  const mountedRoute = router.mounts["/page"]
  t.expect(RouteSet.items(mountedRoute)).toHaveLength(3)

  t.expect(RouteSet.items(mountedRoute)[0].kind).toBe("html")
  t.expect(RouteSet.items(mountedRoute)[1].kind).toBe("html")
  t.expect(RouteSet.items(mountedRoute)[2].kind).toBe("html")
})

t.it("stores routes with different kinds separately", async () => {
  const htmlLayer = Route.html(function*(_c, next) {
    const inner = yield* next()
    return `<wrap>${inner}</wrap>`
  })

  const router = Router
    .mount("/api", Route.json({ data: "value" }))
    .mount("/page", htmlLayer.html(Effect.succeed("content")))

  t.expect(RouteSet.items(router.mounts["/api"]!)).toHaveLength(1)
  t.expect(RouteSet.items(router.mounts["/api"]!)[0].kind).toBe("json")

  t.expect(RouteSet.items(router.mounts["/page"]!)).toHaveLength(2)
  t.expect(RouteSet.items(router.mounts["/page"]!)[0].kind).toBe("html")
  t.expect(RouteSet.items(router.mounts["/page"]!)[1].kind).toBe("html")
})

t.describe("Router.get", () => {
  t.it("returns route matching method and path", () => {
    const router = Router
      .mount("/hello", Route.text("Hello"))
      .mount("/world", Route.json({ message: "World" }))

    const route = Router.get(router, "GET", "/hello")

    t.expect(route).toBeDefined()
    t.expect(route?.method).toBe("GET")
    t.expect(route?.kind).toBe("text")
  })

  t.it("returns undefined for non-existent path", () => {
    const router = Router.mount("/hello", Route.text("Hello"))

    const route = Router.get(router, "GET", "/notfound")

    t.expect(route).toBeUndefined()
  })

  t.it("returns undefined for non-matching method", () => {
    const router = Router.mount("/hello", Route.get(Route.text("Hello")))

    const route = Router.get(router, "POST", "/hello")

    t.expect(route).toBeUndefined()
  })

  t.it("matches with kind filter", () => {
    const router = Router.mount(
      "/content",
      Route.merge(
        Route.text("plain"),
        Route.html("<div>html</div>"),
      ),
    )

    const textRoute = Router.get(router, "GET", "/content", "text")
    const htmlRoute = Router.get(router, "GET", "/content", "html")

    t.expect(textRoute?.kind).toBe("text")
    t.expect(htmlRoute?.kind).toBe("html")
  })

  t.it("wildcard method matches any route", () => {
    const router = Router.mount("/api", Route.post(Route.json({ ok: true })))

    const route = Router.get(router, "*", "/api")

    t.expect(route).toBeDefined()
    t.expect(route?.method).toBe("POST")
  })

  t.it("returns first route when kind not specified", () => {
    const router = Router.mount("/page", Route.html("<div>page</div>"))

    const route = Router.get(router, "GET", "/page")

    t.expect(route).toBeDefined()
    t.expect(route?.kind).toBe("html")
  })
})
