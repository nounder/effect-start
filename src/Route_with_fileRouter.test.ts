import * as test from "bun:test"
import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"
import * as FileHttpRouter from "./FileHttpRouter.ts"
import * as Route from "./Route.ts"
import * as Router from "./Router.ts"
import * as TestHttpClient from "./TestHttpClient.ts"
import { effectFn } from "./testing.ts"

test.describe("Route schema validation via FileHttpRouter", () => {
  test.it("validates path params", () => {
    const routes = [
      {
        path: "/posts/:id/:slug",
        segments: [],
        load: async () => ({
          default: Route
            .schemaPathParams({
              id: Schema.NumberFromString,
              slug: Schema.String,
            })
            .json((ctx) => {
              return Effect.succeed({
                pathParams: ctx.pathParams,
              })
            }),
        }),
      },
    ] as const

    const routerLayer = Router.layerPromise(async () => ({
      modules: routes,
    }))

    const effect = effectFn(routerLayer)

    return effect(function*() {
      const routerContext = yield* Router.Router
      const client = TestHttpClient.make(routerContext.httpRouter)

      const res = yield* client.get("/posts/123/hello-world")
      const data = yield* res.json

      test.expect(data).toEqual({
        pathParams: {
          id: 123,
          slug: "hello-world",
        },
      })
    })
  })

  test.it("validates URL params with single values", () => {
    const routes = [
      {
        path: "/search",
        segments: [],
        load: async () => ({
          default: Route
            .schemaUrlParams({
              page: Schema.NumberFromString,
              q: Schema.String,
            })
            .json((ctx) => {
              return Effect.succeed({
                urlParams: ctx.urlParams,
              })
            }),
        }),
      },
    ] as const

    const routerLayer = Router.layerPromise(async () => ({
      modules: routes,
    }))

    const effect = effectFn(routerLayer)

    return effect(function*() {
      const routerContext = yield* Router.Router
      const client = TestHttpClient.make(routerContext.httpRouter)

      const res = yield* client.get("/search?page=2&q=effect")
      const data = yield* res.json

      test.expect(data).toEqual({
        urlParams: {
          page: 2,
          q: "effect",
        },
      })
    })
  })

  test.it("validates URL params with array values", () => {
    const routes = [
      {
        path: "/posts",
        segments: [],
        load: async () => ({
          default: Route
            .schemaUrlParams({
              tags: Schema.Array(Schema.String),
              limit: Schema.NumberFromString,
            })
            .json((ctx) => {
              return Effect.succeed({
                urlParams: ctx.urlParams,
              })
            }),
        }),
      },
    ] as const

    const routerLayer = Router.layerPromise(async () => ({
      modules: routes,
    }))

    const effect = effectFn(routerLayer)

    return effect(function*() {
      const routerContext = yield* Router.Router
      const client = TestHttpClient.make(routerContext.httpRouter)

      const res = yield* client.get("/posts?tags=typescript&tags=effect&tags=functional&limit=10")
      const data = yield* res.json

      test.expect(data).toEqual({
        urlParams: {
          tags: ["typescript", "effect", "functional"],
          limit: 10,
        },
      })
    })
  })

  test.it("validates combined path params, URL params, and headers", () => {
    const routes = [
      {
        path: "/users/:userId/posts",
        segments: [],
        load: async () => ({
          default: Route
            .schemaPathParams({
              userId: Schema.NumberFromString,
            })
            .schemaUrlParams({
              include: Schema.Array(Schema.String),
            })
            .schemaHeaders({
              authorization: Schema.String,
            })
            .json((ctx) => {
              return Effect.succeed({
                pathParams: ctx.pathParams,
                urlParams: ctx.urlParams,
                headers: ctx.headers,
              })
            }),
        }),
      },
    ] as const

    const routerLayer = Router.layerPromise(async () => ({
      modules: routes,
    }))

    const effect = effectFn(routerLayer)

    return effect(function*() {
      const routerContext = yield* Router.Router
      const client = TestHttpClient.make(routerContext.httpRouter)

      const res = yield* client.get(
        "/users/42/posts?include=comments&include=author",
        {
          headers: {
            authorization: "Bearer token123",
          },
        },
      )
      const data = yield* res.json

      test.expect(data).toEqual({
        pathParams: {
          userId: 42,
        },
        urlParams: {
          include: ["comments", "author"],
        },
        headers: {
          authorization: "Bearer token123",
        },
      })
    })
  })
})
