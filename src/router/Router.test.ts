import * as HttpServerResponse from "@effect/platform/HttpServerResponse"
import * as test from "bun:test"
import * as Effect from "effect/Effect"
import * as type from "expect-type"
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

test.it("creates router with single route", () => {
  const router = Router.mount(
    "/hello",
    Route.text("Hello World"),
  )

  test
    .expect(Object.keys(router.mounts))
    .toHaveLength(1)
  test
    .expect(router.mounts["/hello"])
    .toBeDefined()
  test
    .expect(RouteSet.items(router.mounts["/hello"]!))
    .toHaveLength(1)

  type Mounts = Router.Router.Mounts<typeof router>
  type
    .expectTypeOf<"/hello">()
    .toExtend<keyof Mounts>()
})

test.it("chains multiple routes", () => {
  const router = Router
    .mount("/hello", Route.text("Hello"))
    .mount("/world", Route.text("World"))

  test
    .expect(Object.keys(router.mounts))
    .toHaveLength(2)
  test
    .expect(router.mounts["/hello"])
    .toBeDefined()
  test
    .expect(router.mounts["/world"])
    .toBeDefined()

  type Mounts = Router.Router.Mounts<typeof router>
  type
    .expectTypeOf<"/hello">()
    .toExtend<keyof Mounts>()
  type
    .expectTypeOf<"/world">()
    .toExtend<keyof Mounts>()
})

test.it("infers and unions error types from routes", () => {
  const routerSingle = Router.mount(
    "/fail",
    Route.text(Effect.fail(new AdamError())),
  )

  type SingleError = Router.Router.Error<typeof routerSingle>
  type
    .expectTypeOf<AdamError>()
    .toExtend<SingleError>()

  const routerMultiple = Router
    .mount("/adam", Route.text(Effect.fail(new AdamError())))
    .mount("/eve", Route.text(Effect.fail(new EveError())))

  test
    .expect(Object.keys(routerMultiple.mounts))
    .toHaveLength(2)

  type MultipleError = Router.Router.Error<typeof routerMultiple>
  type
    .expectTypeOf<AdamError>()
    .toExtend<MultipleError>()
  type
    .expectTypeOf<EveError>()
    .toExtend<MultipleError>()
})

test.it("infers context & error types from HttpMiddleware", () => {
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

  test
    .expect(Object.keys(routerSingle.mounts))
    .toHaveLength(1)

  type RouterError = Router.Router.Error<typeof routerSingle>
  type RouterRequirements = Router.Router.Requirements<typeof routerSingle>

  type
    .expectTypeOf<AdamError>()
    .toExtend<RouterError>()
  type
    .expectTypeOf<EveError>()
    .toExtend<RouterError>()
  type
    .expectTypeOf<Random>()
    .toExtend<RouterRequirements>()
})

test.it(
  "Router.use with Route.http(HttpServerResponse) infers never types",
  () => {
    const httpMiddleware = Route.http(HttpServerResponse.text("static"))

    const router = Router
      .use(httpMiddleware)
      .mount("/", Route.text("hello"))

    test
      .expect(Object.keys(router.mounts))
      .toHaveLength(1)

    type RouterError = Router.Router.Error<typeof router>
    type RouterRequirements = Router.Router.Requirements<typeof router>

    type
      .expectTypeOf<RouterError>()
      .toEqualTypeOf<never>()
    type
      .expectTypeOf<RouterRequirements>()
      .toEqualTypeOf<never>()
  },
)

test.it("infers and unions context types from routes", () => {
  const routerSingle = Router
    .mount("/uuid", Route.text(Random.uuid()))

  type SingleRequirements = Router.Router.Requirements<typeof routerSingle>
  type
    .expectTypeOf<Random>()
    .toExtend<SingleRequirements>()

  const routerMultiple = Router
    .mount("/hello", Route.text(Greeting.greet()))
    .mount("/uuid", Route.text(Random.uuid()))

  test
    .expect(Object.keys(routerMultiple.mounts))
    .toHaveLength(2)

  type MultipleRequirements = Router.Router.Requirements<typeof routerMultiple>
  type
    .expectTypeOf<Greeting>()
    .toExtend<MultipleRequirements>()
  type
    .expectTypeOf<Random>()
    .toExtend<MultipleRequirements>()
})

test.it("merges routes at same path", () => {
  const router = Router
    .mount("/api", Route.get(Route.json({ method: "get" })))
    .mount("/api", Route.post(Route.json({ method: "post" })))

  test
    .expect(Object.keys(router.mounts))
    .toHaveLength(1)
  test
    .expect(router.mounts["/api"])
    .toBeDefined()
})

test.it("stores routes without modification", () => {
  const wrapperLayer = Route.html(function*(_c, next) {
    const inner = yield* next()
    return `<wrap>${inner}</wrap>`
  })

  const router = Router
    .mount("/page", wrapperLayer.html(Effect.succeed("content")))
    .mount("/uuid", Route.text(Random.uuid()))

  const mountedRoute = router.mounts["/page"]
  test
    .expect(mountedRoute)
    .toBeDefined()
  test
    .expect(RouteSet.items(mountedRoute))
    .toHaveLength(2)
  test
    .expect(RouteSet.items(mountedRoute)[0].kind)
    .toBe("html")
  test
    .expect(RouteSet.items(mountedRoute)[1].kind)
    .toBe("html")
})

test.it("HttpMiddleware applies to routes mounted after use()", async () => {
  const httpMiddleware = Route.http((app) => app)

  const router = Router
    .mount("/before", Route.html(Effect.succeed("before-content")))
    .use(httpMiddleware)
    .mount("/after", Route.html(Effect.succeed("after-content")))

  test
    .expect(Object.keys(router.mounts))
    .toHaveLength(2)
  test
    .expect(router.mounts["/before"])
    .toBeDefined()
  test
    .expect(router.mounts["/after"])
    .toBeDefined()
})

test.it("stores multiple routes in order", () => {
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
  test
    .expect(RouteSet.items(mountedRoute))
    .toHaveLength(3)
  test
    .expect(RouteSet.items(mountedRoute)[0].kind)
    .toBe("html")
  test
    .expect(RouteSet.items(mountedRoute)[1].kind)
    .toBe("html")
  test
    .expect(RouteSet.items(mountedRoute)[2].kind)
    .toBe("html")
})

test.it("stores routes with different kinds separately", async () => {
  const htmlLayer = Route.html(function*(_c, next) {
    const inner = yield* next()
    return `<wrap>${inner}</wrap>`
  })

  const router = Router
    .mount("/api", Route.json({ data: "value" }))
    .mount("/page", htmlLayer.html(Effect.succeed("content")))

  test
    .expect(RouteSet.items(router.mounts["/api"]!))
    .toHaveLength(1)
  test
    .expect(RouteSet.items(router.mounts["/api"]!)[0].kind)
    .toBe("json")
  test
    .expect(RouteSet.items(router.mounts["/page"]!))
    .toHaveLength(2)
  test
    .expect(RouteSet.items(router.mounts["/page"]!)[0].kind)
    .toBe("html")
  test
    .expect(RouteSet.items(router.mounts["/page"]!)[1].kind)
    .toBe("html")
})

test.describe("Router.get", () => {
  test.it("returns route matching method and path", () => {
    const router = Router
      .mount("/hello", Route.text("Hello"))
      .mount("/world", Route.json({ message: "World" }))

    const route = Router.get(router, "GET", "/hello")

    test
      .expect(route)
      .toBeDefined()
    test
      .expect(route?.method)
      .toBe("GET")
    test
      .expect(route?.kind)
      .toBe("text")
  })

  test.it("returns undefined for non-existent path", () => {
    const router = Router.mount("/hello", Route.text("Hello"))

    const route = Router.get(router, "GET", "/notfound")

    test
      .expect(route)
      .toBeUndefined()
  })

  test.it("returns undefined for non-matching method", () => {
    const router = Router.mount("/hello", Route.get(Route.text("Hello")))

    const route = Router.get(router, "POST", "/hello")

    test
      .expect(route)
      .toBeUndefined()
  })

  test.it("matches with kind filter", () => {
    const router = Router.mount(
      "/content",
      Route.merge(
        Route.text("plain"),
        Route.html("<div>html</div>"),
      ),
    )

    const textRoute = Router.get(router, "GET", "/content", "text")
    const htmlRoute = Router.get(router, "GET", "/content", "html")

    test
      .expect(textRoute?.kind)
      .toBe("text")
    test
      .expect(htmlRoute?.kind)
      .toBe("html")
  })

  test.it("wildcard method matches any route", () => {
    const router = Router.mount("/api", Route.post(Route.json({ ok: true })))

    const route = Router.get(router, "*", "/api")

    test
      .expect(route)
      .toBeDefined()
    test
      .expect(route?.method)
      .toBe("POST")
  })

  test.it("returns first route when kind not specified", () => {
    const router = Router.mount("/page", Route.html("<div>page</div>"))

    const route = Router.get(router, "GET", "/page")

    test
      .expect(route)
      .toBeDefined()
    test
      .expect(route?.kind)
      .toBe("html")
  })
})
