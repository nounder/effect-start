import {
  BunTailwindPlugin,
  Start,
  FileRouter
  Bundle
} from "effect-start"
import { TailwindPlugin } from "effect-start/x/tailwind"

export default Start.layer(
  FileRouter.layer(() => import("./routes/_manifest")),
  Bundle.client({
    entrypoints: [
      "src/index.html",
    ],
    plugins: [
      BunTailwindPlugin.make(),
    ],
  }),
)

if (import.meta.main) {
  Start.serve(() => import(import.meta.url))
}
