import * as Error from "@effect/platform/Error"
import * as FileSystem from "@effect/platform/FileSystem"
import * as HttpApp from "@effect/platform/HttpApp"
import * as HttpRouter from "@effect/platform/HttpRouter"
import { RouteNotFound } from "@effect/platform/HttpServerError"
import * as HttpServerResponse from "@effect/platform/HttpServerResponse"
import {
  expect,
  test,
} from "bun:test"
import * as Data from "effect/Data"
import * as Effect from "effect/Effect"
import * as FileHttpRouter from "./FileHttpRouter.ts"
import type * as Router from "./Router.ts"

class CustomError extends Data.TaggedError("CustomError") {}

// Mock server routes with different error and requirement types
const Routes = [
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
    path: "/posts",
    load: async () => ({
      GET: Effect.succeed(
        HttpServerResponse.text("Posts list"),
      ) as HttpApp.Default<"PostError", "PostService">,
      default: Effect.succeed(
        HttpServerResponse.text("Default handler"),
      ) as HttpApp.Default<never, never>,
    }),
  },
] as const
test("HttpRouter Requirement and Error types infers", async () => {
  const routerEffect = FileHttpRouter.make(Routes)

  const router = await Effect.runPromise(routerEffect)

  // This should fail to compile if the router type is HttpRouter<any, any>
  const _typeCheck: typeof router extends HttpRouter.HttpRouter<
    Error.SystemError | "PostError" | RouteNotFound | CustomError,
    FileSystem.FileSystem | "PostService"
  > ? true
    : false = true
})

test("HTTP methods", async () => {
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

  const router = await Effect.runPromise(FileHttpRouter.make([allMethodsRoute]))
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
})
