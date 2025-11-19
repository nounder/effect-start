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

  t.it("should provide layout service with route context and slots", async () => {
    const layoutHandler: RouteServices.LayoutHandler = (ctx) => {
      ctx.slots.title = "Test Page"

      return Effect.succeed({
        type: "div",
        props: {
          children: ctx.children,
          "data-path": ctx.route.path,
          "data-title": ctx.slots.title,
        },
      })
    }

    const layer = RouteServices.makeLayoutLayer(layoutHandler)

    const routeContext: RouteServices.RouteContext = {
      request: {} as any,
      url: new URL("http://localhost/test"),
      path: "/test",
      params: {},
      slots: {},
    }

    const routeLayer = Layer.succeed(RouteServices.Route, routeContext)

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
        "data-title": "Test Page",
      },
    })

    t.expect(routeContext.slots.title).toBe("Test Page")
  })

  t.it("should allow direct slots mutation", async () => {
    const layoutHandler: RouteServices.LayoutHandler = (ctx) => {
      ctx.slots.title = "My Title"
      ctx.slots.description = "My Description"

      return Effect.succeed({
        type: "html",
        props: {
          children: [
            { type: "title", props: { children: ctx.slots.title } },
            ctx.children,
          ],
        },
      })
    }

    const layer = RouteServices.makeLayoutLayer(layoutHandler)

    const routeContext: RouteServices.RouteContext = {
      request: {} as any,
      url: new URL("http://localhost/test"),
      path: "/test",
      params: {},
      slots: {},
    }

    const routeLayer = Layer.succeed(RouteServices.Route, routeContext)

    const program = Effect.gen(function*() {
      const layoutService = yield* RouteServices.LayoutService
      const wrapped = yield* layoutService.wrap("Content")

      return wrapped
    })

    const result = await Effect.runPromise(
      program.pipe(
        Effect.provide(Layer.merge(routeLayer, layer)),
      ),
    )

    t.expect(result.props.children[0].props.children).toBe("My Title")
    t.expect(routeContext.slots.title).toBe("My Title")
    t.expect(routeContext.slots.description).toBe("My Description")
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
