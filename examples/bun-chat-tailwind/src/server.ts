import {
  Route,
  Start,
} from "effect-start"
import routes from "./routes.ts"

export default Start.layer(
  Route.layer(routes),
)

if (import.meta.main) {
  Start.serve(() => import("./server.ts"))
}
