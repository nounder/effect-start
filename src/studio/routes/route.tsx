import * as Route from "../../Route.ts"
import * as Studio from "../Studio.ts"

export default Route.get(
  Route.render(function* () {
    const studio = yield* Studio.Studio
    return Route.redirect(`${studio.path}/traces`)
  }),
)
