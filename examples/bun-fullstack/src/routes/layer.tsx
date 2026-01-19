import { Route } from "effect-start"
import { BunRoute } from "effect-start/bun"

/*
 * Route layer defines common behavior for all routes within this layer.
 * Routes are chained together using the fluent API.
 */
export default Route.use(
  /*
   * wrap all html routes in layout
   * no need for custom BunRoute type
   * how will we recognize it when scanning BunServer
   */
  Route.html(
    BunRoute.bundle(() => import("../app.html")),
  ),
  /**
   * Wrap all JSON in 'data' property
   */
  Route.json(function*(ctx, next) {
    const value = yield* next()

    // how are we going to detect an error happened?
    if (false) {
      return {
        error: value,
      }
    }

    return {
      data: value,
    }
  }),
)
