import * as HttpMiddleware from "@effect/platform/HttpMiddleware"
import { Route } from "effect-start"
import * as Effect from "effect/Effect"

export default Route.layer(
  Route.http(
    HttpMiddleware.make((app) =>
      Effect.gen(function*() {
        const startTime = Date.now()
        const res = yield* app
        const duration = Date.now() - startTime
        console.log(`Request completed in ${duration}ms`)
        return res
      })
    ),
  ),
  Route.html(function*(context) {
    const inner = yield* context.next()

    return (
      <html>
        <head>
          <title>
            {context.slots.title ?? "Default title"}
          </title>
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
      wrappedResponse: inner,
    }
  }),
)
