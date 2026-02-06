import { Route } from "effect-start"
import { BunRoute } from "effect-start/bun"

export default Route.use(BunRoute.htmlBundle(() => import("../app.html")))
