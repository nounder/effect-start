import { BunRoute } from "effect-start/bun"

export default BunRoute
  .loadBundle(() => import("../../app.html"))
