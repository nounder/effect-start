import * as Effect from "effect/Effect"
import * as BunRoute from "../../bun/BunRoute.ts"
import * as Route from "../../Route.ts"
import * as StudioStore from "../StudioStore.ts"

export default Route.use(
  Route.filter(function* () {
    yield* Effect.annotateCurrentSpan(StudioStore.studioTraceAttribute, true)
    return { context: {} }
  }),
  BunRoute.htmlBundle(() => import("./layout.html")),
)
