import { Route } from "effect-start"
import * as Effect from "effect/Effect"

export default Route.layer(
  Route.html(function*(context) {
    const inner = yield* context.next()

    return (
      <html>
        <head>
          <title>
            {context.slots.title ?? "Default title"}
          </title>
          {context.slots.head}
        </head>
        <body>
          <h1>
            Root Layout
          </h1>
          {Effect.succeed(0)}
        </body>
      </html>
    )
  }),
  Route.json(function*(context) {
    const inner = yield* context.next()

    return {
      data: inner,
    }
  }),
)
