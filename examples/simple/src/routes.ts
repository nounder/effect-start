import { Schema } from "effect"
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
})
