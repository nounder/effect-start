import { Schema } from "effect"
import { Route } from "effect-start"

export default Route
  .use(
    Route.schemaHeaders(
      Schema.Struct({
        "hello": Schema.String,
      }),
    ),
  )
  .get(
    Route.schemaHeaders(
      Schema.Struct({
        "x-custom-header": Schema.String,
      }),
    ),
    Route.html(function*(ctx) {
      return `<h1>Hello, world!</h1>`
    }),
  )
