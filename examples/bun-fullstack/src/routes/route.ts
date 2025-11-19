import { BunRoute } from "effect-start/bun"

export default BunRoute.load(() => import("../index.html"))
