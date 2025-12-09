import { Route } from "effect-start"
import { BunRoute } from "effect-start/bun"
import * as Effect from "effect/Effect"

// Route layer defines common behavior for all routes within this layer.
export default Route.layer(
  // All routes will use this HTML layout.
  // BunRoute will use Bun Full-stack server to serve HTML,
  // with automatic bundling transparent and HMR in development.
  BunRoute.html(() => import("../app.html")),
  // Here, we are wrapping all JSON responses in a `data` field.
  // This only applies to JSON routes within this layer.
  Route.json(function*(context) {
    // context.next() calls matched route
    const inner = yield* context.next()

    return {
      data: inner,
    }
  }),
)
