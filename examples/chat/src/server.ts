import { Development, FileRouter, Start } from "effect-start"
import { BunBundle, BunServer } from "effect-start/bun"
import { Studio } from "effect-start/studio"
import { TailwindPlugin } from "effect-start/tailwind"

export default Start.pack(
  Studio.layer(),
  Development.layer(),
  FileRouter.layer(() => import("./routes/.server.ts")),
  BunBundle.layer({
    entrypoints: [import.meta.resolve("./app.css"), "effect-start/datastar"],
    plugins: [TailwindPlugin.make()],
  }),
  Start.layerDev(),
  BunServer.layer(),
)

Start.runMain(import.meta)
