import { Development, FileRouter, Start } from "effect-start"
import { BunServer } from "effect-start/bun"
import { Simulation, Studio } from "effect-start/studio"

export default Start.pack(
  Studio.layer(),
  Development.layer(),
  FileRouter.layer(() => import("./routes/.server.ts")),
  Start.layerDev(),
)

Start.runMain(import.meta)
