import { Layer } from "effect"
import { Development, FileRouter, Start } from "effect-start"
import { BunBundle, BunServer } from "effect-start/bun"
import { Studio } from "effect-start/studio"
import { TailwindPlugin } from "effect-start/tailwind"
import * as FetchHttpClient from "effect/http/FetchHttpClient"

export default Layer.mergeAll(
  FetchHttpClient.layer,
  Studio.layer(),
  FileRouter.layer(),
  Development.layer(),
  BunBundle.layer({
    entrypoints: [import.meta.resolve("./app.css"), "effect-start/datastar"],
    plugins: [TailwindPlugin.make()],
  }),
  Start.layerDev(),
  BunServer.layer(),
)

Start.runMain(import.meta)
