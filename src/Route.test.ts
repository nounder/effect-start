import * as test from "bun:test"
import * as Effect from "effect/Effect"
import * as Function from "effect/Function"
import * as Route from "./Route.ts"

test.it("types default routes", () => {
  const routes = Route
    .text(
      Effect.succeed("hello"),
    )
    .html(
      Effect.succeed(""),
    )

  Function.satisfies<
    Route.RouteSet<[
      Route.Route<
        "",
        "GET",
        "text/plain"
      >,
      Route.Route<
        "",
        "GET",
        "text/html"
      >,
    ]>
  >()(routes)
})

test.it("types GET & POST routes", () => {
  const routes = Route
    .text(
      Effect.succeed("hello"),
    )
    .html(
      Effect.succeed(""),
    )
    .post(
      Route
        .text(
          Effect.succeed("hello"),
        ),
    )

  Function.satisfies<
    Route.RouteSet<[
      Route.Route<
        "",
        "GET",
        "text/plain"
      >,
      Route.Route<
        "",
        "GET",
        "text/html"
      >,
      Route.Route<
        "",
        "POST",
        "text/plain"
      >,
    ]>
  >()(routes)
})
