import { HttpServerResponse } from "@effect/platform"
import { Schema } from "effect"
import { Route } from "effect-start"
import { BasicAuthMiddleware } from "effect-start/middlewares"

export default Route
  .use(
    BasicAuthMiddleware.make({
      username: "admin",
      password: "admin",
    }),
    Route.schemaUrlParams({
      id: Schema.String,
    }),
  )
  .get(
    Route.html(function*(action) {
      // we need to type case here due to react types mismatch
      const inner = yield* action.next() as any

      action.slots.head = `<title>Admin Panel</title>`

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
