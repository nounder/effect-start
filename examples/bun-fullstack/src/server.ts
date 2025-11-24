import { Start } from "effect-start"

export default Start.layer(
  Start.router({
    load: () => import("./routes"),
    path: import.meta.resolve("./routes"),
  }),
)

if (import.meta.main) {
  Start.serve(() => import(import.meta.url))
}
