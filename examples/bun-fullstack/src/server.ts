import {
  FileRouter,
  Start,
} from "effect-start"

export default Start.layer(
  FileRouter.layer({
    load: () => import("./routes/manifest.ts"),
    path: import.meta.resolve("./routes/manifest.ts"),
  }),
)

if (import.meta.main) {
  Start.serve(() => import("./server.ts"))
}
