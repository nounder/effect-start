import * as Effect from "effect/Effect"
import * as Route from "./Route.ts"

const route = Route
  .text(
    Effect.succeed("hello world"),
  )
  .post(
    Route.text(
      Effect.succeed("post"),
    ),
  )
