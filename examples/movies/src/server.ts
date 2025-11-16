import {
  Bundle,
  FileRouter,
  Start,
} from "effect-start"

export default Start.layer(
  Start.router({
    load: () => import("./routes/manifest.ts"),
    path: import.meta.resolve("./routes/manifest.ts"),
  }),
)

if (import.meta.main) {
  Start.serve(() => import(import.meta.url))
}
