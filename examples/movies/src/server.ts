import {
  Bundle,
  FileRouter,
  Start,
} from "effect-start"
import * as Layer from "effect/Layer"
import { DataService } from "./Data.ts"
import { Sql } from "./Sql.ts"

export default Start.layer(
  Start.router({
    load: () => import("./routes/manifest.ts"),
    path: import.meta.resolve("./routes/manifest.ts"),
  }),
  DataService.Default,
  Sql.Default,
)

if (import.meta.main) {
  Start.serve(() => import(import.meta.url))
}
