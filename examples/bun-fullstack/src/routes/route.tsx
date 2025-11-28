import { Schema } from "effect"
import { Route } from "effect-start"

export default Route
  .html(function*(c) {
    return (
      <h1>
        Hello, world!
      </h1>
    )
  })
