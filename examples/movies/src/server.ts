import * as Layer from "effect/Layer"
import {
  Bundle,
  FileRouter,
  Start,
} from "effect-start"
import { Sql } from "./Sql.ts"
import { MediaStorage } from "./MediaStorage.ts"

export default Layer.mergeAll(
  Start.layer(
    Start.router({
      load: () => import("./routes/manifest.ts"),
      path: import.meta.resolve("./routes/manifest.ts"),
    }),
  ),
  Sql.Default,
  MediaStorage.Default,
)

if (import.meta.main) {
  Start.serve(() => import(import.meta.url))
}
