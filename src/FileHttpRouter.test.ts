import * as Error from "@effect/platform/Error"
import * as FileSystem from "@effect/platform/FileSystem"
import * as HttpApp from "@effect/platform/HttpApp"
import * as HttpRouter from "@effect/platform/HttpRouter"
import * as HttpServerResponse from "@effect/platform/HttpServerResponse"
import * as t from "bun:test"
import * as Data from "effect/Data"
import * as Effect from "effect/Effect"
import * as FileHttpRouter from "./FileHttpRouter.ts"
import * as Route from "./Route.ts"
import * as Router from "./Router.ts"
import * as TestHttpClient from "./TestHttpClient.ts"
import { effectFn } from "./testing.ts"

class CustomError extends Data.TaggedError("CustomError") {}

const SampleRoutes = [
  {
    path: "/users",
    load: async () => ({
      default: Route
        .html(Effect.succeed("Users list"))
        .post(Route.html(Effect.succeed("User created"))),
    }),
  },
  {
    path: "/articles",
    load: async () => ({
      default: Route.html(Effect.succeed("Articles list")),
    }),
  },
] as const

const SampleRouteManifest: Router.RouterManifest = {
  routes: SampleRoutes,
}

const routerLayer = Router.layerPromise(async () => SampleRouteManifest)

const effect = effectFn(routerLayer)

t.it("HttpRouter Requirement and Error types infers", () =>
  effect(function*() {
    const router = yield* FileHttpRouter.make(SampleRoutes)

    // This should fail to compile if the router type is HttpRouter<any, any>
    const _typeCheck: typeof router extends HttpRouter.HttpRouter<
      Error.SystemError | "PostError" | CustomError,
      FileSystem.FileSystem | "PostService"
    > ? true
      : false = true
  }))

t.it("HTTP methods", () =>
  effect(function*() {
    const allMethodsRoute: Router.LazyRoute = {
      path: "/",
      load: async () => ({
        default: Route
          .html(Effect.succeed("GET"))
          .post(Route.html(Effect.succeed("POST")))
          .put(Route.html(Effect.succeed("PUT")))
          .patch(Route.html(Effect.succeed("PATCH")))
          .del(Route.html(Effect.succeed("DELETE")))
          .options(Route.html(Effect.succeed("OPTIONS")))
          .head(Route.html(Effect.succeed("HEAD"))),
      }),
    }

    const router = yield* FileHttpRouter.make([allMethodsRoute])
    const routesList = Array.from(router.routes)

    t
      .expect(routesList)
      .toEqual(
        t.expect.arrayContaining([
          t.expect.objectContaining({ path: "/", method: "GET" }),
          t.expect.objectContaining({ path: "/", method: "POST" }),
          t.expect.objectContaining({ path: "/", method: "PUT" }),
          t.expect.objectContaining({ path: "/", method: "PATCH" }),
          t.expect.objectContaining({ path: "/", method: "DELETE" }),
          t.expect.objectContaining({ path: "/", method: "OPTIONS" }),
          t.expect.objectContaining({ path: "/", method: "HEAD" }),
        ]),
      )
  }))

t.it("router handles requests correctly", () =>
  effect(function*() {
    const router = yield* FileHttpRouter.make(SampleRoutes)
    const client = TestHttpClient.make(router)

    const getUsersResponse = yield* client.get("/users")

    t
      .expect(getUsersResponse.status)
      .toBe(200)

    t
      .expect(yield* getUsersResponse.text)
      .toBe("Users list")

    const postUsersResponse = yield* client.post("/users")

    t
      .expect(postUsersResponse.status)
      .toBe(200)

    t
      .expect(yield* postUsersResponse.text)
      .toBe("User created")
  }))

t.it("middleware falls back to original app on 404", () =>
  effect(function*() {
    const middleware = FileHttpRouter.middleware()
    const fallbackApp = Effect.succeed(HttpServerResponse.text("fallback"))
    const middlewareApp = middleware(fallbackApp)

    const client = TestHttpClient.make(middlewareApp)

    const existingRouteResponse = yield* client.get("/users")

    t
      .expect(existingRouteResponse.status)
      .toBe(200)

    t
      .expect(yield* existingRouteResponse.text)
      .toBe("Users list")

    const notFoundResponse = yield* client.get("/nonexistent")

    t
      .expect(notFoundResponse.status)
      .toBe(200)

    t
      .expect(yield* notFoundResponse.text)
      .toBe("fallback")
  }))

t.it(
  "handles routes with special characters (tilde and hyphen)",
  () =>
    effect(function*() {
      const specialCharRoutes: Router.LazyRoute[] = [
        {
          path: "/api-v1",
          load: async () => ({
            default: Route.text("API v1"),
          }),
        },
        {
          path: "/files~backup",
          load: async () => ({
            default: Route.text("Backup files"),
          }),
        },
        {
          path: "/test-route~temp",
          load: async () => ({
            default: Route.post(Route.text("Test route")),
          }),
        },
      ]

      const router = yield* FileHttpRouter.make(specialCharRoutes)
      const client = TestHttpClient.make(router)

      const apiResponse = yield* client.get("/api-v1")

      t
        .expect(apiResponse.status)
        .toBe(200)

      t
        .expect(yield* apiResponse.text)
        .toBe("API v1")

      const backupResponse = yield* client.get("/files~backup")

      t
        .expect(backupResponse.status)
        .toBe(200)

      t
        .expect(yield* backupResponse.text)
        .toBe("Backup files")

      const testResponse = yield* client.post("/test-route~temp")

      t
        .expect(testResponse.status)
        .toBe(200)

      t
        .expect(yield* testResponse.text)
        .toBe("Test route")
    }),
)

t.it(
  "layer routes can wrap inner routes using next()",
  () =>
    effect(function*() {
      const routeWithLayer: Router.LazyRoute = {
        path: "/page",
        load: async () => ({
          default: Route.html(Effect.succeed("<h1>Page Content</h1>")),
        }),
        layers: [
          async () => ({
            default: Route.layer(
              Route.html(function*(context) {
                const innerContent = yield* context.next()
                return `<html><body>${innerContent}</body></html>`
              }),
            ),
          }),
        ],
      }

      const router = yield* FileHttpRouter.make([routeWithLayer])
      const client = TestHttpClient.make(router)

      const response = yield* client.get("/page")

      t.expect(response.status).toBe(200)

      const html = yield* response.text

      t.expect(html).toBe("<html><body><h1>Page Content</h1></body></html>")
    }),
)

t.it("nested layers compose correctly with next()", () =>
  effect(function*() {
    const routeWithNestedLayers: Router.LazyRoute = {
      path: "/nested",
      load: async () => ({
        default: Route.html(Effect.succeed("content")),
      }),
      layers: [
        async () => ({
          default: Route.layer(
            Route.html(function*(context) {
              const inner = yield* context.next()
              return `<div class="outer">${inner}</div>`
            }),
          ),
        }),
        async () => ({
          default: Route.layer(
            Route.html(function*(context) {
              const inner = yield* context.next()
              return `<div class="inner">${inner}</div>`
            }),
          ),
        }),
      ],
    }

    const router = yield* FileHttpRouter.make([routeWithNestedLayers])
    const client = TestHttpClient.make(router)

    const response = yield* client.get("/nested")

    t.expect(response.status).toBe(200)

    const html = yield* response.text

    t.expect(html).toBe(
      "<div class=\"outer\"><div class=\"inner\">content</div></div>",
    )
  }))
