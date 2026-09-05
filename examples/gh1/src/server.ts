import { Development, FileRouter, Start } from "effect-start"
import { BunBundle, BunPlugin } from "effect-start/bun"
import { Studio } from "effect-start/studio"
import { TailwindPlugin } from "effect-start/tailwind"

export default Start.pack(
  Studio.layer(),
  Development.layer(),
  FileRouter.layer(),
  BunBundle.layer({
    entrypoints: [import.meta.resolve("./app.css"), "effect-start/datastar"],
    plugins: [BunPlugin.toBunPlugin(TailwindPlugin.make())],
  }),
  Start.layerDev(),
)

Start.runMain(import.meta)
