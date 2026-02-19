import { Development, FileRouter, Start } from "effect-start"
import { Simulation, Studio } from "effect-start/studio"
import { TailscaleTunnel } from "effect-start/x/tailscale"

export default Start.pack(
  Studio.layerRoutes(),
  Simulation.layer(),
  TailscaleTunnel.layer(),
  Studio.layer(),
  Development.layer(),
  FileRouter.layer(() => import("./routes/server.gen.ts")),
)

if (import.meta.main) {
  Start.serve(() => import("./server.ts"))
}
