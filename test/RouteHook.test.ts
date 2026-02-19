import * as test from "bun:test"
import { Effect } from "effect"
import * as Route from "effect-start/Route"

test.it("passes bindings", () => {
  const headers = {
    origin: "nounder.org",
  }
  const filterResult = {
    context: {
      headers,
    },
  }

  const routes = Route.empty.pipe(
    Route.filter(() => Effect.succeed(filterResult)),
    Route.text((context) => {
      test.expectTypeOf(context).toExtend<typeof filterResult.context>()

      return Effect.succeed(`Origin: ${context.headers.origin}`)
    }),
  )

  test
    .expectTypeOf(routes)
    .toExtend<
      Route.RouteSet.RouteSet<
        {},
        {},
        [
          Route.Route.Route<{}, typeof filterResult.context, any>,
          Route.Route.Route<{ format: "text" }, {}, string>,
        ]
      >
    >()

  test.expect(Route.items(routes)).toHaveLength(2)
})
