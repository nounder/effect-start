import {
  Bundle,
  BunTailwindPlugin,
  FileRouter,
  Start,
} from "effect-start"

export default Start.make(
  Start.development(),
  FileRouter.layer(() => import("./routes")),
  Start.bundleClient({
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
