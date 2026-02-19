import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Route from "../Route.ts"
import * as RouteTree from "../RouteTree.ts"
import * as sqlBun from "../sql/bun/index.ts"
import type * as SqlClient from "../sql/SqlClient.ts"
import * as StudioErrors from "./StudioErrors.ts"
import * as StudioLogger from "./StudioLogger.ts"
import * as StudioMetrics from "./StudioMetrics.ts"
import * as StudioProcess from "./StudioProcess.ts"
import * as StudioStore from "./StudioStore.ts"
import * as StudioTracer from "./StudioTracer.ts"
import consoleRoutes from "./routes/tree.ts"

export function layer(
  options?: StudioStore.StudioStoreOptions & {
    readonly sqlLayer?: Layer.Layer<SqlClient.SqlClient, SqlClient.SqlError>
  },
): Layer.Layer<StudioStore.StudioStore> {
  const sqlLayer =
    options?.sqlLayer ?? sqlBun.layer({ adapter: "sqlite" as const, filename: ":memory:" })
  const store = StudioStore.layer(options).pipe(Layer.provide(sqlLayer), Layer.orDie)
  const features = Layer.mergeAll(
    StudioTracer.layer,
    StudioLogger.layer,
    StudioMetrics.layer,
    StudioErrors.layer,
    StudioProcess.layer,
  ).pipe(Layer.provide(store))
  return Layer.merge(store, features)
}

export function layerRoutes(options?: { prefix?: string }) {
  const prefix = options?.prefix ?? "/studio"

  return Layer.effect(
    Route.Routes,
    Effect.gen(function* () {
      const existing = yield* Route.Routes
      StudioStore.store.prefix = prefix
      const tree = Route.tree({
        [prefix as "/"]: consoleRoutes,
      })
      return RouteTree.merge(existing, tree)
    }),
  )
}
