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
import * as Router from "./Router.ts"
import * as TestHttpClient from "./TestHttpClient.ts"
import { effectFn } from "./testing.ts"

class CustomError extends Data.TaggedError("CustomError") {}

const SampleRoutes = [
  {
    path: "/users",
    load: async () => ({
      GET: Effect.succeed(
        HttpServerResponse.text("Users list"),
      ) as HttpApp.Default<CustomError, never>,
      POST: Effect.succeed(
        HttpServerResponse.text("User created"),
      ) as HttpApp.Default<Error.SystemError, FileSystem.FileSystem>,
    }),
  },
  {
    path: "/articles",
    load: async () => ({
      GET: Effect.succeed(
        HttpServerResponse.text("Articles list"),
      ) as HttpApp.Default<"PostError", "PostService">,
    }),
  },
] as const

const SampleRouteManifest: Router.RouteManifest = {
  Pages: [],
  Layouts: [],
  Servers: SampleRoutes,
}

const routerLayer = Router.layer(async () => SampleRouteManifest)

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
      load: async () => ({
        GET: Effect.succeed(HttpServerResponse.text("GET")),
        POST: Effect.succeed(HttpServerResponse.text("POST")),
        PUT: Effect.succeed(HttpServerResponse.text("PUT")),
        PATCH: Effect.succeed(HttpServerResponse.text("PATCH")),
        DELETE: Effect.succeed(HttpServerResponse.text("DELETE")),
        OPTIONS: Effect.succeed(HttpServerResponse.text("OPTIONS")),
        HEAD: Effect.succeed(HttpServerResponse.text("HEAD")),
        default: Effect.succeed(HttpServerResponse.text("DEFAULT")),
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
          expect.objectContaining({ path: "/", method: "*" }),
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
        load: async () => ({
          GET: Effect.succeed(HttpServerResponse.text("API v1")),
        }),
      },
      {
        path: "/files~backup",
        load: async () => ({
          GET: Effect.succeed(HttpServerResponse.text("Backup files")),
        }),
      },
      {
        path: "/test-route~temp",
        load: async () => ({
          POST: Effect.succeed(HttpServerResponse.text("Test route")),
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
