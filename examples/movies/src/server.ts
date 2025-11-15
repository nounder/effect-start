import {
  Bundle,
  FileRouter,
  Start,
} from "effect-start"

export default Start.layer(
  // TODO: update the signature
  FileRouter.layer({
    load: () => import("./routes/manifest.expected.ts"),
    path: import.meta.resolve("./routes/manifest.ts"),
  }),
  Start.bundleClient("src/index.html"),
)

if (import.meta.main) {
  Start.serve(() => import(import.meta.url))
}
