import {
  Router,
  Start,
} from "effect-start"

export default Start.layer(
  Router.layerFiles({
    load: () => import("./routes"),
    path: import.meta.resolve("./routes"),
  }),
)

if (import.meta.main) {
  Start.serve(() => import("./server"))
}
