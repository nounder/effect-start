import { Start } from "effect-start"
import { BunHttpServer } from "effect-start/bun"

export default Start.layer(
  Start.router({
    load: () => import("./routes"),
    path: import.meta.resolve("./routes"),
  }),
)

if (import.meta.main) {
  Start.serve(() => import("./server"))
}
