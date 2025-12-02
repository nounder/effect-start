import { BunRoute } from "effect-start/bun"

export default BunRoute
  .html(() => import("../../app.html"))
