import * as HttpMiddleware from "@effect/platform/HttpMiddleware"
import * as HttpServerResponse from "@effect/platform/HttpServerResponse"
import * as test from "bun:test"
import * as Effect from "effect/Effect"
import * as Function from "effect/Function"
import * as type from "expect-type"
import * as Route from "./Route.ts"
import * as Router from "./Router.ts"
import * as RouteSet from "./RouteSet.ts"

class Greeting extends Effect.Tag("Greeting")<Greeting, {
  greet(): string
}>() {}

class Random extends Effect.Tag("Random")<Random, {
  boolean(): boolean
  number(): number
  uuid(): string
}>() {}

class AdamError {
  readonly _tag = "AdamError"
}

class EveError {
  readonly _tag = "EveError"
}

test.describe("Router mount tracking", () => {
  test.it("tracks single mount with path and RouteSet types", () => {
    const router = Router.mount(
      "/hello",
      Route.text("Hello World"),
    )

    type Mounts = Router.Router.Mounts<typeof router>
    type ExpectedMounts = {
      readonly "/hello": RouteSet.RouteSet<
        [
          Route.Route<
            "GET",
            "text",
            Route.RouteHandler<"Hello World", never, never>
          >,
        ]
      >
    }

    type
      .expectTypeOf<Mounts>()
      .toEqualTypeOf<ExpectedMounts>()
    test
      .expect(Object.keys(router.mounts))
      .toHaveLength(1)
  })

  test.it("tracks multiple mounts with distinct paths", () => {
    const router = Router
      .mount("/hello", Route.text("Hello"))
      .mount("/world", Route.json({ message: "World" }))

    type Mounts = Router.Router.Mounts<typeof router>

    type
      .expectTypeOf<"/hello">()
      .toExtend<keyof Mounts>()
    type
      .expectTypeOf<"/world">()
      .toExtend<keyof Mounts>()
    test
      .expect(Object.keys(router.mounts))
      .toHaveLength(2)
  })

  test.it("merges routes at same path", () => {
    const router = Router
      .mount("/api", Route.get(Route.json({ method: "get" })))
      .mount("/api", Route.post(Route.json({ method: "post" })))

    type Mounts = Router.Router.Mounts<typeof router>
    type ApiMount = Mounts["/api"]
    type ApiRoutes = RouteSet.RouteSet.Items<ApiMount>

    type
      .expectTypeOf<ApiRoutes>()
      .toHaveProperty("length")
      .toEqualTypeOf<2>()
    test
      .expect(Object.keys(router.mounts))
      .toHaveLength(1)
    test
      .expect(RouteSet.items(router.mounts["/api"]!))
      .toHaveLength(2)
  })

  test.it("layer is tracked separately from mounts", () => {
    const middleware = Route.http(
      HttpMiddleware.make(app =>
        Effect.gen(function*() {
          const res = yield* app
          return Function.pipe(
            res,
            HttpServerResponse.setHeader("X-Custom-Header", "CustomValue"),
          )
        })
      ),
    )

    const router = Router
      .use(middleware)
      .mount("/hello", Route.text("Hello, World!"))

    type Layer = Router.Router.Layer<typeof router>
    type LayerRoutes = RouteSet.RouteSet.Items<Layer>

    type
      .expectTypeOf<LayerRoutes[0]>()
      .toExtend<Route.Route<"*", "http", any, any>>()
    test
      .expect(RouteSet.items(router.layer))
      .toHaveLength(1)
  })

  test.it("layer routes merge into mounts", () => {
    const middleware = Route.html(function*(_c, next) {
      const inner = yield* next()
      return `<wrap>${inner}</wrap>`
    })

    const router = Router
      .use(middleware)
      .mount("/page", Route.html(Effect.succeed("content")))

    type Mounts = Router.Router.Mounts<typeof router>
    type PageMount = Mounts["/page"]
    type PageRoutes = RouteSet.RouteSet.Items<PageMount>

    type
      .expectTypeOf<PageRoutes>()
      .toHaveProperty("length")
      .toEqualTypeOf<2>()
    test
      .expect(RouteSet.items(router.mounts["/page"]!))
      .toHaveLength(2)
  })
})

test.describe("Router.entries", () => {
  test.it("returns array of path/routes entries", () => {
    const router = Router
      .mount("/hello", Route.text("Hello"))
      .mount("/world", Route.json({ message: "World" }))

    const routerEntries = Router.entries(router)

    test
      .expect(routerEntries)
      .toHaveLength(2)

    const paths = routerEntries.map(e => e.path)

    test
      .expect(paths)
      .toContain("/hello")
    test
      .expect(paths)
      .toContain("/world")
  })

  test.it("entries type tracks path and RouteSet", () => {
    const router = Router
      .mount("/hello", Route.text("Hello"))

    type Entries = Router.Router.Entries<typeof router>

    type
      .expectTypeOf<Entries>()
      .toExtend<Router.Router.Entry<"/hello", any>>()
  })
})

test.describe("Router.Error derives from mounts", () => {
  test.it("extracts error from single mount", () => {
    const router = Router.mount(
      "/fail",
      Route.text(Effect.fail(new AdamError())),
    )

    type RouterError = Router.Router.Error<typeof router>

    type
      .expectTypeOf<AdamError>()
      .toExtend<RouterError>()
  })

  test.it("unions errors from multiple mounts", () => {
    const router = Router
      .mount("/adam", Route.text(Effect.fail(new AdamError())))
      .mount("/eve", Route.text(Effect.fail(new EveError())))

    type RouterError = Router.Router.Error<typeof router>

    type
      .expectTypeOf<AdamError>()
      .toExtend<RouterError>()
    type
      .expectTypeOf<EveError>()
      .toExtend<RouterError>()
    test
      .expect(Object.keys(router.mounts))
      .toHaveLength(2)
  })

  test.it("includes errors from layer", () => {
    const httpMiddleware = Route.http((app) =>
      Effect.gen(function*() {
        return yield* Effect.fail(new AdamError())
        return yield* app
      })
    )

    const router = Router
      .use(httpMiddleware)
      .mount("/", Route.text(Effect.fail(new EveError())))

    type RouterError = Router.Router.Error<typeof router>

    type
      .expectTypeOf<AdamError>()
      .toExtend<RouterError>()
    type
      .expectTypeOf<EveError>()
      .toExtend<RouterError>()
  })
})

test.describe("Router.Requirements derives from mounts", () => {
  test.it("extracts requirements from single mount", () => {
    const router = Router.mount(
      "/uuid",
      Route.text(Random.uuid()),
    )

    type RouterRequirements = Router.Router.Requirements<typeof router>

    type
      .expectTypeOf<Random>()
      .toExtend<RouterRequirements>()
  })

  test.it("unions requirements from multiple mounts", () => {
    const router = Router
      .mount("/greet", Route.text(Greeting.greet()))
      .mount("/uuid", Route.text(Random.uuid()))

    type RouterRequirements = Router.Router.Requirements<typeof router>

    type
      .expectTypeOf<Greeting>()
      .toExtend<RouterRequirements>()
    type
      .expectTypeOf<Random>()
      .toExtend<RouterRequirements>()
    test
      .expect(Object.keys(router.mounts))
      .toHaveLength(2)
  })

  test.it("includes requirements from layer", () => {
    const httpMiddleware = Route.http((app) =>
      Effect.gen(function*() {
        yield* Random.uuid()
        return yield* app
      })
    )

    const router = Router
      .use(httpMiddleware)
      .mount("/", Route.text(Greeting.greet()))

    type RouterRequirements = Router.Router.Requirements<typeof router>

    type
      .expectTypeOf<Random>()
      .toExtend<RouterRequirements>()
    type
      .expectTypeOf<Greeting>()
      .toExtend<RouterRequirements>()
  })
})

test.describe("Router type inference", () => {
  test.it("tracks mounts without errors", () => {
    const router = Router
      .mount("/hello", Route.text("Hello"))
      .mount("/world", Route.json({ data: "World" }))

    type Mounts = Router.Router.Mounts<typeof router>

    type
      .expectTypeOf<"/hello">()
      .toExtend<keyof Mounts>()
    type
      .expectTypeOf<"/world">()
      .toExtend<keyof Mounts>()
  })

  test.it("HttpServerResponse routes are tracked in layer", () => {
    const router = Router
      .use(Route.http(HttpServerResponse.text("static")))
      .mount("/hello", Route.text("Hello"))

    type Layer = Router.Router.Layer<typeof router>
    type LayerRoutes = RouteSet.RouteSet.Items<Layer>

    type
      .expectTypeOf<LayerRoutes>()
      .toHaveProperty("length")
      .toEqualTypeOf<1>()
    test
      .expect(RouteSet.items(router.layer))
      .toHaveLength(1)
  })
})
