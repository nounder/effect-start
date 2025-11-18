import {
  Bundle,
  FileRouter,
  Start,
} from "effect-start"
import * as Layer from "effect/Layer"
import { SqlLive } from "./services/Sql.ts"

export default Layer.mergeAll(
  Start.router({
    load: () => import("./routes/manifest.ts"),
    path: import.meta.resolve("./routes/manifest.ts"),
  }),
  SqlLive,
)

if (import.meta.main) {
  Start.serve(() => import(import.meta.url))
}
