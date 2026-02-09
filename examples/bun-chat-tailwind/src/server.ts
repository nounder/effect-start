import { Development, FileRouter, Start } from "effect-start"
import { TailscaleTunnel } from "effect-start/x/tailscale"

export default Start.layer(
  TailscaleTunnel.layer(),
  FileRouter.layer(() => import("./routes/server.gen.ts")),
  Development.layerWatch(),
)

if (import.meta.main) {
  Start.serve(() => import("./server.ts"))
}
