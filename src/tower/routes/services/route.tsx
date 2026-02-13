import * as Effect from "effect/Effect"
import * as Route from "../../../Route.ts"
import * as HyperRoute from "../../../hyper/HyperRoute.ts"
import * as TowerStore from "../../TowerStore.ts"
import * as Services from "../../ui/Services.tsx"
import * as Shell from "../../ui/Shell.tsx"

export default Route.get(
  HyperRoute.html(function* () {
    const ctx = yield* Effect.context<never>()
    const services = Services.collectServices(ctx.unsafeMap)
    return (
      <Shell.Shell prefix={TowerStore.store.prefix} active="services">
        <div class="tab-header">Services ({services.length})</div>
        <div class="tab-body">
          <Services.ServiceList services={services} />
        </div>
      </Shell.Shell>
    )
  }),
)
