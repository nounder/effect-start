import { Development, FileRouter, Start } from "effect-start"
import { Studio } from "effect-start/studio"

export default Start.pack(
  Studio.layer(),
  Development.layer(),
  FileRouter.layer(() => import("./routes/.server.ts")),
)

if (import.meta.main) {
  Start.serve(() => import("./server.ts"))
}
