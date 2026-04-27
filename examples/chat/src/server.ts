import { Development, FileRouter, Start } from "effect-start"
import { Simulation, Studio } from "effect-start/studio"
import { TailscaleTunnel } from "effect-start/tailscale"

export default Start.pack(
  Simulation.layer(),
  Studio.layer(),
  Development.layer(),
  FileRouter.layer(() => import("./routes/.server.ts")),
)

if (import.meta.main) {
  Start.serve(() => import("./server.ts"))
}
