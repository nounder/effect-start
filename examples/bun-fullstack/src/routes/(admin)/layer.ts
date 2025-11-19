import { Route } from "effect-start"
import { BasicAuthMiddleware } from "effect-start/middlewares"

export default Route.layer(
  Route.middleware(
    BasicAuthMiddleware.static({
      user: "admin",
      password: "admin",
    }),
  ),
  Route.catch<RouteErrors, "/(admin)">(function*(cause) {
    const req = yield* Request.Request

    if (Request.expects(req, "html")) {
      return html``
    } else {
      return Response
    }
  }),
)
