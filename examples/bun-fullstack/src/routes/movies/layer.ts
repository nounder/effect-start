import { Route } from "effect-start"
import { routeUrl } from "routes"

export default Route.layer(
  Route
    .layout(function*(props) {
      const route = yield* Route.Route
      const usersUrl = routeUrl("users")

      return `
        <div>
          <a href="${usersUrl}">
            yo
          </a>
          <h1>
            Users Layout
          </h1>
          <div>
            ${props.children}
          </div>
        </div>
      `
    }),
)
