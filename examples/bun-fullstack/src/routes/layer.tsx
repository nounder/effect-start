import { Route } from "effect-start"
import { BunRoute } from "effect-start/bun"

/*
 * Route layer defines common behavior for all routes within this layer.
 * Routes are chained together using the fluent API.
 */
export default Route
  /*
   * wrap all html routes in layout
   * no need for custom BunRoute type
   * how will we recognize it when scanning BunServer
   */
  .html(BunRoute.bundle(() => import("../app.html")))
  /**
   * Wrap all JSON in 'data' property
   */
  .json(function*(context) {
    return {
      data: yield* context.next(),
    }
  })
