import { Start } from "effect-start"
import { BunServer } from "effect-start/bun"
import { Studio } from "effect-start/studio"

export default Start.pack(
  Studio.layer({ path: "/studio" }),
  BunServer.layer({ port: 4318 }),
)

Start.runMain(import.meta)
