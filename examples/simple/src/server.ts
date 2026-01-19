import {
  Route,
  Start,
} from "effect-start"
import routes from "./routes.ts"

export default Start.layer(
  // provies RouteTree
  // stores routes and allows to be accessed from
  // BunRoute
  Route.layer(routes),
)

if (import.meta.main) {
  Start.serve(() => import("./server.ts"))
}
