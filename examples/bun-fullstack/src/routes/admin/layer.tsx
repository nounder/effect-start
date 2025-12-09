import { Route } from "effect-start"
import * as BasicAuthMiddleware from "effect-start/middlewares/BasicAuthMiddleware"

export default Route.layer(
  Route.http(
    BasicAuthMiddleware.make({
      username: "admin",
      password: "admin",
    }),
  ),
  Route.html(function*(context) {
    // we need to type case here due to react types mismatch
    const inner = yield* context.next() as any

    context.slots.head = `<title>Admin Panel</title>`

    return (
      <div className="admin-container">
        <h2>
          Admin Panel
        </h2>
        {inner}
      </div>
    )
  }),
)
