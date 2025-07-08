import { Layer } from "effect"
import { Start } from "effect-bundler"

export default Layer.mergeAll(
  // Start.router(() => import("./routes/_manifest")),
  Start.bundleClient("src/index.html"),
)

if (import.meta.main) {
  Start.serve(() => import("./server"))
}
