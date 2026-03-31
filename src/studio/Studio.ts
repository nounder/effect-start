import * as Layer from "effect/Layer"
import * as Route from "../Route.ts"
import * as sqlBun from "../sql/bun/index.ts"
import type * as SqlClient from "../sql/SqlClient.ts"
import * as StudioErrors from "./StudioErrors.ts"
import * as StudioLogger from "./StudioLogger.ts"
import * as StudioMetrics from "./StudioMetrics.ts"
import * as StudioProcess from "./StudioProcess.ts"
import * as StudioStore from "./StudioStore.ts"
import * as StudioTracer from "./StudioTracer.ts"
import routes from "./routes/tree.ts"

export function layer(
  options?: StudioStore.StudioStoreOptions & {
    readonly sqlLayer?: Layer.Layer<SqlClient.SqlClient, SqlClient.SqlError>
  },
): Layer.Layer<StudioStore.StudioStore | SqlClient.SqlClient> {
  const sqlLayer =
    options?.sqlLayer ?? sqlBun.layer({ adapter: "sqlite" as const, filename: ":memory:" })
  const providedSqlLayer = sqlLayer.pipe(Layer.orDie)
  const store = StudioStore.layer(options).pipe(Layer.provide(providedSqlLayer), Layer.orDie)
  const features = Layer.mergeAll(
    StudioTracer.layer,
    StudioLogger.layer,
    StudioMetrics.layer,
    StudioErrors.layer,
    StudioProcess.layer,
  ).pipe(Layer.provide(store))
  return Layer.mergeAll(providedSqlLayer, store, features)
}

export function layerRoutes(options?: { prefix?: string }) {
  const prefix = options?.prefix ?? "/studio"
  StudioStore.store.prefix = prefix
  return Route.layerMerge({
    [prefix as "/"]: routes,
  })
}
