import * as Effect from "effect/Effect"
import * as Route from "../../../Route.ts"
import * as Studio from "../../Studio.ts"
import * as Services from "../../ui/Services.tsx"
import * as Shell from "../../ui/Shell.tsx"

export default Route.get(
  Route.html(function* () {
    const studio = yield* Studio.Studio
    const ctx = yield* Effect.context<never>()
    const services = Services.collectServices(ctx.unsafeMap)
    return (
      <Shell.Shell prefix={studio.prefix} active="services">
        <div class="tab-header">Services ({services.length})</div>
        <div class="tab-body">
          <Services.ServiceList services={services} />
        </div>
      </Shell.Shell>
    )
  }),
)
