import * as Route from "../../Route.ts"
import * as StudioStore from "../StudioStore.ts"

export default Route.get(
  Route.render(function* () {
    return Route.redirect(`${StudioStore.store.prefix}/traces`)
  }),
)
