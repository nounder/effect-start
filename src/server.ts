import { HttpRouter, HttpServerResponse } from "@effect/platform"
import { Effect } from "effect"
import { handleHttpServerResponseError } from "./effect/http.ts"
import { SsrApp } from "./ssr.tsx"

const ApiApp = HttpRouter.empty.pipe(
  HttpRouter.get(
    "/yo",
    HttpServerResponse.text("yo"),
  ),
  HttpRouter.get(
    "/error",
    Effect.gen(function*() {
      throw new Error("custom error")

      return HttpServerResponse.text("this will never be reached")
    }),
  ),
  HttpRouter.catchAllCause(handleHttpServerResponseError),
  Effect.catchTag(
    "RouteNotFound",
    e =>
      HttpServerResponse.empty({
        status: 404,
      }),
  ),
)

export { ApiApp, SsrApp }
