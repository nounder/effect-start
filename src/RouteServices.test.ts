import * as t from "bun:test"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Route from "./Route.ts"
import * as RouteServices from "./RouteServices.ts"

t.describe("RouteServices", () => {
  t.it("should create layout layer", async () => {
    const layoutHandler: RouteServices.LayoutHandler = (ctx) =>
      Effect.succeed({
        type: "div",
        props: {
          children: [
            { type: "h1", props: { children: "Layout" } },
            ctx.children,
          ],
        },
      })

    const layer = RouteServices.makeLayoutLayer(layoutHandler)

    t.expect(Layer.isLayer(layer)).toBe(true)
  })

  t.it("should provide layout service with route context", async () => {
    const layoutHandler: RouteServices.LayoutHandler = (ctx) =>
      Effect.succeed({
        type: "div",
        props: {
          children: ctx.children,
          "data-path": ctx.route.path,
        },
      })

    const layer = RouteServices.makeLayoutLayer(layoutHandler)

    const routeInfo: RouteServices.RouteInfo = {
      request: {} as any,
      url: new URL("http://localhost/test"),
      path: "/test",
      params: {},
      context: new Map(),
    }

    const routeLayer = Layer.succeed(RouteServices.Route, routeInfo)

    const program = Effect.gen(function*() {
      const layoutService = yield* RouteServices.LayoutService
      const wrapped = yield* layoutService.wrap("Hello")

      return wrapped
    })

    const result = await Effect.runPromise(
      program.pipe(
        Effect.provide(Layer.merge(routeLayer, layer)),
      ),
    )

    t.expect(result).toEqual({
      type: "div",
      props: {
        children: "Hello",
        "data-path": "/test",
      },
    })
  })

  t.it("should provide route context with metadata", async () => {
    const program = Effect.gen(function*() {
      yield* Route.context.set("title", "Test Page")
      yield* Route.context.set("description", "A test page")

      const title = yield* Route.context.get("title")
      const description = yield* Route.context.get("description")
      const missing = yield* Route.context.get("missing")

      return { title, description, missing }
    })

    const routeInfo: RouteServices.RouteInfo = {
      request: {} as any,
      url: new URL("http://localhost/test"),
      path: "/test",
      params: {},
      context: new Map(),
    }

    const result = await Effect.runPromise(
      program.pipe(
        Effect.provide(Layer.succeed(RouteServices.Route, routeInfo)),
      ),
    )

    t.expect(result).toEqual({
      title: "Test Page",
      description: "A test page",
      missing: undefined,
    })
  })

  t.it("should merge multiple layers", () => {
    const layout1 = Route.layout((ctx) =>
      Effect.succeed({
        type: "div",
        props: { children: ctx.children },
      })
    )

    const layout2 = Route.layout((ctx) =>
      Effect.succeed({
        type: "section",
        props: { children: ctx.children },
      })
    )

    const merged = Route.layer(layout1, layout2)

    t.expect(Layer.isLayer(merged)).toBe(true)
  })

  t.it("should handle empty layer", () => {
    const empty = Route.layer()

    t.expect(Layer.isLayer(empty)).toBe(true)
  })

  t.it("should handle single layer", () => {
    const layout = Route.layout((ctx) =>
      Effect.succeed({
        type: "div",
        props: { children: ctx.children },
      })
    )

    const single = Route.layer(layout)

    t.expect(single).toBe(layout)
  })
})
