import * as t from "bun:test"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as RouteServices from "./RouteServices.ts"

t.describe("RouteServices - Slots", () => {
  t.it("route context contains slots object", async () => {
    const program = Effect.gen(function*() {
      const route = yield* RouteServices.Route
      return route.slots
    })

    const routeContext: RouteServices.RouteContext = {
      request: {} as any,
      url: new URL("http://localhost/test"),
      path: "/test",
      params: {},
      slots: {},
    }

    const result = await Effect.runPromise(
      program.pipe(
        Effect.provide(Layer.succeed(RouteServices.Route, routeContext)),
      ),
    )

    t.expect(result).toEqual({})
    t.expect(typeof result).toBe("object")
  })

  t.it("route context contains slots with default properties", async () => {
    const program = Effect.gen(function*() {
      const route = yield* RouteServices.Route
      return route.slots
    })

    const routeContext: RouteServices.RouteContext = {
      request: {} as any,
      url: new URL("http://localhost/test"),
      path: "/test",
      params: {},
      slots: {
        title: "Default Title",
        description: "Default Description",
      },
    }

    const result = await Effect.runPromise(
      program.pipe(
        Effect.provide(Layer.succeed(RouteServices.Route, routeContext)),
      ),
    )

    t.expect(result.title).toBe("Default Title")
    t.expect(result.description).toBe("Default Description")
  })

  t.it("route handler can read slots", async () => {
    const program = Effect.gen(function*() {
      const route = yield* RouteServices.Route
      const title = route.slots.title
      const description = route.slots.description
      return { title, description }
    })

    const routeContext: RouteServices.RouteContext = {
      request: {} as any,
      url: new URL("http://localhost/test"),
      path: "/test",
      params: {},
      slots: {
        title: "My Page Title",
        description: "My Page Description",
      },
    }

    const result = await Effect.runPromise(
      program.pipe(
        Effect.provide(Layer.succeed(RouteServices.Route, routeContext)),
      ),
    )

    t.expect(result.title).toBe("My Page Title")
    t.expect(result.description).toBe("My Page Description")
  })

  t.it("route handler can write to slots", async () => {
    const program = Effect.gen(function*() {
      const route = yield* RouteServices.Route

      route.slots.title = "Updated Title"
      route.slots.description = "Updated Description"
      route.slots.custom = "Custom Value"

      return route.slots
    })

    const routeContext: RouteServices.RouteContext = {
      request: {} as any,
      url: new URL("http://localhost/test"),
      path: "/test",
      params: {},
      slots: {},
    }

    const result = await Effect.runPromise(
      program.pipe(
        Effect.provide(Layer.succeed(RouteServices.Route, routeContext)),
      ),
    )

    t.expect(result.title).toBe("Updated Title")
    t.expect(result.description).toBe("Updated Description")
    t.expect(result.custom).toBe("Custom Value")

    t.expect(routeContext.slots.title).toBe("Updated Title")
    t.expect(routeContext.slots.description).toBe("Updated Description")
    t.expect(routeContext.slots.custom).toBe("Custom Value")
  })

  t.it("slots mutations persist across yields", async () => {
    const program = Effect.gen(function*() {
      const route = yield* RouteServices.Route

      route.slots.title = "First"

      yield* Effect.succeed(void 0)

      route.slots.description = "Second"

      const routeAgain = yield* RouteServices.Route

      return {
        title: routeAgain.slots.title,
        description: routeAgain.slots.description,
      }
    })

    const routeContext: RouteServices.RouteContext = {
      request: {} as any,
      url: new URL("http://localhost/test"),
      path: "/test",
      params: {},
      slots: {},
    }

    const result = await Effect.runPromise(
      program.pipe(
        Effect.provide(Layer.succeed(RouteServices.Route, routeContext)),
      ),
    )

    t.expect(result.title).toBe("First")
    t.expect(result.description).toBe("Second")
  })

  t.it("slots support custom properties beyond title and description", async () => {
    const program = Effect.gen(function*() {
      const route = yield* RouteServices.Route

      route.slots.author = "John Doe"
      route.slots.publishedDate = "2024-01-01"
      route.slots.tags = ["typescript", "effect"]
      route.slots.metadata = { views: 100, likes: 50 }

      return route.slots
    })

    const routeContext: RouteServices.RouteContext = {
      request: {} as any,
      url: new URL("http://localhost/test"),
      path: "/test",
      params: {},
      slots: {},
    }

    const result = await Effect.runPromise(
      program.pipe(
        Effect.provide(Layer.succeed(RouteServices.Route, routeContext)),
      ),
    )

    t.expect(result.author).toBe("John Doe")
    t.expect(result.publishedDate).toBe("2024-01-01")
    t.expect(result.tags).toEqual(["typescript", "effect"])
    t.expect(result.metadata).toEqual({ views: 100, likes: 50 })
  })
})
