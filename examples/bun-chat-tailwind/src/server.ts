import { Development, FileRouter, Start } from "effect-start"

export default Start.layer(
  FileRouter.layer(() => import("./routes/server.gen.ts")),
  Development.layerWatch(),
)

if (import.meta.main) {
  Start.serve(() => import("./server.ts"))
}
