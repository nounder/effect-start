import * as BunRoute from "../../bun/BunRoute.ts"
import * as Route from "../../Route.ts"

export default Route.use(BunRoute.htmlBundle(() => import("./layout.html")))
