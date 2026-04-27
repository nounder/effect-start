import * as Route from "../../../Route.ts"
import * as RouteTree from "../../../RouteTree.ts"
import * as Studio from "../../Studio.ts"
import * as Routes from "../../ui/Routes.tsx"
import * as Shell from "../../ui/Shell.tsx"

export default Route.get(
  Route.html(function* () {
    const studio = yield* Studio.Studio
    const tree = yield* Route.Routes
    const routes: Array<Routes.RouteInfo> = []
    for (const route of RouteTree.walk(tree)) {
      const desc = Route.descriptor(route)
      routes.push({
        method: desc.method ?? "*",
        path: desc.path ?? "/",
        format: desc.format,
      })
    }

    return (
      <Shell.Shell prefix={studio.prefix} active="routes">
        <div class="tab-header">Routes</div>
        <div class="tab-body">
          <Routes.RouteList routes={routes} />
        </div>
      </Shell.Shell>
    )
  }),
)
