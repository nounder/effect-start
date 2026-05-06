import * as Route from "../../../Route.ts"
import * as RouteMap from "../../../RouteMap.ts"
import * as Studio from "../../Studio.ts"
import * as Routes from "../../ui/Routes.tsx"
import * as Shell from "../../ui/Shell.tsx"

export default Route.get(
  Route.html(function* () {
    const studio = yield* Studio.Studio
    const routes = yield* Route.Routes
    const infos: Array<Routes.RouteInfo> = Array.from(RouteMap.walk(routes), (route) => {
      const desc = Route.descriptor(route)
      return {
        method: desc.method ?? "*",
        path: desc.path ?? "/",
        format: desc.format,
      }
    })

    return (
      <Shell.Shell prefix={studio.path} active="routes">
        <div class="tab-header">Routes</div>
        <div class="tab-body">
          <Routes.RouteList routes={infos} />
        </div>
      </Shell.Shell>
    )
  }),
)
