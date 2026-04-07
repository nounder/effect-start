import { Development, FileRouter, Start } from "effect-start"
import { BunBundle } from "effect-start/bun"
import { Studio } from "effect-start/studio"
import { TailwindPlugin } from "effect-start/tailwind"

export default Start.pack(
  Studio.layer(),
  Development.layer(),
  FileRouter.layer(() => import("./routes/.server.ts")),
  BunBundle.layer({
    entrypoints: [import.meta.resolve("./app.css"), "effect-start/datastar"],
    plugins: [
      TailwindPlugin.make({
        scanPath: import.meta.dir,
      }),
    ],
  }),
)

if (import.meta.main) {
  Start.serve(() => import("./server.ts"))
}
