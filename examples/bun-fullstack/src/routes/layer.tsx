import { Effect } from "effect"
import { Route } from "effect-start"

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
          {inner}
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
