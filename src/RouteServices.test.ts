import * as t from "bun:test"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Option from "effect/Option"
import * as Route from "./Route.ts"
import * as RouteServices from "./RouteServices.ts"

t.describe("RouteServices", () => {
  t.it("should create layout layer", async () => {
    const layoutHandler: RouteServices.LayoutHandler = (props) =>
      Effect.gen(function*() {
        const route = yield* RouteServices.Route
        return {
          type: "div",
          props: {
            children: [
              { type: "h1", props: { children: "Layout" } },
              props.children,
            ],
          },
        }
      })

    const layer = RouteServices.makeLayoutLayer(layoutHandler)

    t.expect(Layer.isLayer(layer)).toBe(true)
  })

  t.it("should provide layout service", async () => {
    const layoutHandler: RouteServices.LayoutHandler = (props) =>
      Effect.gen(function*() {
        return {
          type: "div",
          props: { children: props.children },
        }
      })

    const layer = RouteServices.makeLayoutLayer(layoutHandler)

    const routeInfo: RouteServices.RouteInfo = {
      request: {} as any,
      url: new URL("http://localhost/test"),
      path: "/test",
      params: {},
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
      props: { children: "Hello" },
    })
  })

  t.it("should provide metadata service", async () => {
    const program = Effect.gen(function*() {
      const metadata = yield* RouteServices.RouteMetadata

      yield* metadata.set("title", "Test Page")
      yield* metadata.set("description", "A test page")

      const title = yield* metadata.get("title")
      const description = yield* metadata.get("description")
      const missing = yield* metadata.get("missing")

      return { title, description, missing }
    })

    const result = await Effect.runPromise(
      program.pipe(
        Effect.provide(RouteServices.RouteMetadata.Live),
      ),
    )

    t.expect(result).toEqual({
      title: Option.some("Test Page"),
      description: Option.some("A test page"),
      missing: Option.none(),
    })
  })

  t.it("should merge multiple layers", () => {
    const layout1 = Route.layout(() =>
      Effect.succeed({
        type: "div",
        props: { children: "Layout 1" },
      })
    )

    const layout2 = Route.layout(() =>
      Effect.succeed({
        type: "div",
        props: { children: "Layout 2" },
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
    const layout = Route.layout(() =>
      Effect.succeed({
        type: "div",
        props: { children: "Layout" },
      })
    )

    const single = Route.layer(layout)

    t.expect(single).toBe(layout)
  })
})
