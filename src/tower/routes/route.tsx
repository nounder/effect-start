import * as Route from "../../Route.ts"
import * as TowerStore from "../TowerStore.ts"

export default Route.get(
  Route.render(function* () {
    return Route.redirect(`${TowerStore.store.prefix}/traces`)
  }),
)
