import {
  Route,
  Start,
} from "effect-start"
import { BunHttpServer } from "effect-start/bun"
import routes from "./routes.ts"

export default Start.layer(
  // provies RouteTree
  // stores routes and allows to be accessed from
  Route.layer(routes),
)

if (import.meta.main) {
  Start.serve(() => import("./server.ts"))
}
