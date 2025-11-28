import { Route } from "effect-start"
import * as Schema from "effect/Schema"

export default Route
  .schemaUrlParams({
    name: Schema.String.pipe(
      Schema.optional,
    ),
  })
  .text(function*() {
    return "Hello, world!"
  })
