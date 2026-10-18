import { Development, FileRouter, Start } from "effect-start"
import { BunBundle } from "effect-start/bun"
import { Studio } from "effect-start/studio"
import { TailwindPlugin } from "effect-start/tailwind"
import { FetchHttpClient } from "effect/http"

export default Start.pack(
  FetchHttpClient.layer,
  Studio.layer(),
  Development.layer(),
  FileRouter.layer(),
  BunBundle.layer({
    entrypoints: [import.meta.resolve("./app.css"), "effect-start/datastar"],
    plugins: [TailwindPlugin.make()],
  }),
  Start.layerDev(),
)

Start.runMain(import.meta)
