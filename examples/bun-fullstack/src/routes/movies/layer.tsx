import { Route } from "effect-start"
import { routeUrl } from "routes"

export default Route.layer(
  Route
    .layout(function*(props) {
      const route = yield* Route.Route

      return (
        <div>
          <a href={routeUrl("users")}>
            yo
          </a>
          <h1>
            Users Layout
          </h1>
          <div>
            {props.children}
          </div>
        </div>
      )
    }),
)
