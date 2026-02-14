import { Development, FileRouter, Start } from "effect-start"
import { Simulation, Tower } from "effect-start/tower"
import { TailscaleTunnel } from "effect-start/x/tailscale"

export default Start.pack(
  Tower.layerRoutes(),
  Simulation.layer(),
  TailscaleTunnel.layer(),
  Tower.layer(),
  Development.layerWatch(),
  FileRouter.layer(() => import("./routes/server.gen.ts")),
)

if (import.meta.main) {
  Start.serve(() => import("./server.ts"))
}
