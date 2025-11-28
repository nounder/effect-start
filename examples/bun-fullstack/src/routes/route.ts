import { Route } from "effect-start"
import * as Schema from "effect/schema"

export default Route
  .schemaUrlParams({
    name: Schema.String,
  })
  .text(function*() {
    return "Hello, world!"
  })
  .html(function*() {
    return "Hello, HTML!"
  })
