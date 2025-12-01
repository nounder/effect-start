import {
  Router,
  Start,
} from "effect-start"

export default Start.layer(
  Router.layerFiles({
    load: () => import("./routes/manifest.ts"),
    path: import.meta.resolve("./routes/manifest.ts"),
  }),
)

if (import.meta.main) {
  Start.serve(() => import("./server.ts"))
}
