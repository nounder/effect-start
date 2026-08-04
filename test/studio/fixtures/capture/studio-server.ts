import { Start } from "effect-start"
import { BunBundle, BunServer } from "effect-start/bun"
import { Studio } from "effect-start/studio"

export default Start.pack(
  Studio.layer({ path: "/studio" }),
  BunBundle.layer({ entrypoints: [import.meta.resolve("./app.css")] }),
  BunServer.layer({ port: 4318 }),
)

Start.runMain(import.meta)
