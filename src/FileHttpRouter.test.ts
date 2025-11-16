import * as Error from "@effect/platform/Error"
import * as FileSystem from "@effect/platform/FileSystem"
import * as HttpApp from "@effect/platform/HttpApp"
import * as HttpRouter from "@effect/platform/HttpRouter"
import * as HttpServerResponse from "@effect/platform/HttpServerResponse"
import {
  expect,
  test,
} from "bun:test"
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
    segments: [{ literal: "users" }],
    load: async () => ({
      default: Route
        .html(Effect.succeed("Users list"))
        .post(Route.html(Effect.succeed("User created"))),
    }),
  },
  {
    path: "/articles",
    segments: [{ literal: "articles" }],
    load: async () => ({
      default: Route.html(Effect.succeed("Articles list")),
    }),
  },
] as const

const SampleRouteManifest: Router.RouteManifest = {
  modules: SampleRoutes,
}

const routerLayer = Router.layerPromise(async () => SampleRouteManifest)

const effect = effectFn(routerLayer)

test("HttpRouter Requirement and Error types infers", () =>
  effect(function*() {
    const router = yield* FileHttpRouter.make(SampleRoutes)

    // This should fail to compile if the router type is HttpRouter<any, any>
    const _typeCheck: typeof router extends HttpRouter.HttpRouter<
      Error.SystemError | "PostError" | CustomError,
      FileSystem.FileSystem | "PostService"
    > ? true
      : false = true
  }))

test("HTTP methods", () =>
  effect(function*() {
    const allMethodsRoute: Router.ServerRoute = {
      path: "/",
      segments: [],
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

    expect(routesList)
      .toEqual(
        expect.arrayContaining([
          expect.objectContaining({ path: "/", method: "GET" }),
          expect.objectContaining({ path: "/", method: "POST" }),
          expect.objectContaining({ path: "/", method: "PUT" }),
          expect.objectContaining({ path: "/", method: "PATCH" }),
          expect.objectContaining({ path: "/", method: "DELETE" }),
          expect.objectContaining({ path: "/", method: "OPTIONS" }),
          expect.objectContaining({ path: "/", method: "HEAD" }),
        ]),
      )
  }))

test("router handles requests correctly", () =>
  effect(function*() {
    const routerContext = yield* Router.Router
    const client = TestHttpClient.make(routerContext.httpRouter)

    const getUsersResponse = yield* client.get("/users")

    expect(getUsersResponse.status)
      .toBe(200)

    expect(yield* getUsersResponse.text)
      .toBe("Users list")

    const postUsersResponse = yield* client.post("/users")

    expect(postUsersResponse.status)
      .toBe(200)

    expect(yield* postUsersResponse.text)
      .toBe("User created")
  }))

test("middleware falls back to original app on 404", () =>
  effect(function*() {
    const middleware = FileHttpRouter.middleware()
    const fallbackApp = Effect.succeed(HttpServerResponse.text("fallback"))
    const middlewareApp = middleware(fallbackApp)

    const client = TestHttpClient.make(middlewareApp)

    const existingRouteResponse = yield* client.get("/users")

    expect(existingRouteResponse.status)
      .toBe(200)

    expect(yield* existingRouteResponse.text)
      .toBe("Users list")

    const notFoundResponse = yield* client.get("/nonexistent")

    expect(notFoundResponse.status)
      .toBe(200)

    expect(yield* notFoundResponse.text)
      .toBe("fallback")
  }))

test("handles routes with special characters (tilde and hyphen)", () =>
  effect(function*() {
    const specialCharRoutes: Router.ServerRoute[] = [
      {
        path: "/api-v1",
        segments: [{ literal: "api-v1" }],
        load: async () => ({
          default: Route.text(Effect.succeed("API v1")),
        }),
      },
      {
        path: "/files~backup",
        segments: [{ literal: "files~backup" }],
        load: async () => ({
          default: Route.text(Effect.succeed("Backup files")),
        }),
      },
      {
        path: "/test-route~temp",
        segments: [{ literal: "test-route~temp" }],
        load: async () => ({
          default: Route.post(Route.text(Effect.succeed("Test route"))),
        }),
      },
    ]

    const router = yield* FileHttpRouter.make(specialCharRoutes)
    const client = TestHttpClient.make(router)

    const apiResponse = yield* client.get("/api-v1")

    expect(apiResponse.status)
      .toBe(200)

    expect(yield* apiResponse.text)
      .toBe("API v1")

    const backupResponse = yield* client.get("/files~backup")

    expect(backupResponse.status)
      .toBe(200)

    expect(yield* backupResponse.text)
      .toBe("Backup files")

    const testResponse = yield* client.post("/test-route~temp")

    expect(testResponse.status)
      .toBe(200)

    expect(yield* testResponse.text)
      .toBe("Test route")
  }))
