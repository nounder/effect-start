import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Route from "../Route.ts"
import * as RouteTree from "../RouteTree.ts"
import * as sqlBun from "effect-start/sql/bun"
import type * as Sql from "../sql/SqlClient.ts"
import * as TowerErrors from "./TowerErrors.ts"
import * as TowerLogger from "./TowerLogger.ts"
import * as TowerMetrics from "./TowerMetrics.ts"
import * as TowerProcess from "./TowerProcess.ts"
import * as TowerStore from "./TowerStore.ts"
import * as TowerTracer from "./TowerTracer.ts"
import consoleRoutes from "./routes/tree.ts"

export function layer(
  options?: TowerStore.TowerStoreOptions & {
    readonly sqlLayer?: Layer.Layer<Sql.SqlClient, Sql.SqlError>
  },
): Layer.Layer<TowerStore.TowerStore> {
  const sqlLayer = options?.sqlLayer ?? sqlBun.layer({ adapter: "sqlite", filename: ":memory:" } as any)
  const store = TowerStore.layer(options).pipe(Layer.provide(sqlLayer), Layer.orDie)
  const features = Layer.mergeAll(
    TowerTracer.layer,
    TowerLogger.layer,
    TowerMetrics.layer,
    TowerErrors.layer,
    TowerProcess.layer,
  ).pipe(Layer.provide(store))
  return Layer.merge(store, features)
}

export function layerRoutes(options?: {
  prefix?: string
}) {
  const prefix = options?.prefix ?? "/tower"

  return Layer.effect(
    Route.Routes,
    Effect.gen(function* () {
      const existing = yield* Route.Routes
      TowerStore.store.prefix = prefix
      const tree = Route.tree({
        [prefix as "/"]: consoleRoutes,
      })
      return RouteTree.merge(existing, tree)
    }),
  )
}
