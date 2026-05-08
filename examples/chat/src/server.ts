import { Development, FileRouter, Start } from "effect-start"
import { Simulation, Studio } from "effect-start/studio"

export default Start.build(
  Simulation.layer(),
  Studio.layer(),
  Development.layer(),
  FileRouter.layer(() => import("./routes/.server.ts")),
)

if (import.meta.main) {
  Start.serve(() => import("./server.ts"))
}
