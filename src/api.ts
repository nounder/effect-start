import { HttpRouter, HttpServerResponse } from "@effect/platform"
import { Effect } from "effect"

export default HttpRouter.empty.pipe(
  HttpRouter.get("/yo", HttpServerResponse.text("yo")),
  HttpRouter.get(
    "/error",
    Effect.gen(function*() {
      yield* Effect.fail(new Error("custom error"))

      return HttpServerResponse.text("this will never be reached")
    }),
  ),
)
