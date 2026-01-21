import { Effect, Schedule, Schema, Stream } from "effect"
import { Route } from "effect-start"

export default Route.tree({
  "/": Route.get(
    Route.text("Homepage"),
  ),
  "/data.json": Route
    .get(
      Route.schemaHeaders(Schema.Struct({
        auth: Schema.String,
      })),
      Route.json(function*(ctx) {
        return {
          woah22: 23,
        }
      }),
    ),
  "/events": Route.get(
    Route.text(function*() {
      return Stream.repeat(
        Effect.sync(() => new Date().toISOString() + "\n"),
        Schedule.fixed(100),
      )
    }),
  ),
})
