import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
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

type StudioAuth = {
  readonly type: "basic"
  readonly username: string
  readonly password: string
}

export interface StudioService {
  readonly prefix: string
  readonly auth: StudioAuth | undefined
  readonly store: StudioStore.StudioStoreShape
}

export class Studio extends Context.Tag("effect-start/Studio")<Studio, StudioService>() {}

export interface StudioOptions extends StudioStore.StudioStoreOptions {
  readonly prefix?: string
  readonly auth?: StudioAuth
  readonly sqlLayer?: Layer.Layer<SqlClient.SqlClient, SqlClient.SqlError>
}

function layerStore(options?: StudioOptions) {
  const sqlLayer =
    options?.sqlLayer ?? sqlBun.layer({ adapter: "sqlite" as const, filename: ":memory:" })
  const providedSqlLayer = sqlLayer.pipe(Layer.orDie)
  const storeLayer = StudioStore.layer(options).pipe(Layer.provide(providedSqlLayer), Layer.orDie)
  const studioLayer = Layer.effect(
    Studio,
    Effect.gen(function* () {
      const store = yield* StudioStore.StudioStore
      return {
        prefix: options?.prefix ?? "/studio",
        auth: options?.auth,
        store,
      }
    }),
  ).pipe(Layer.provide(storeLayer))
  return Layer.mergeAll(providedSqlLayer, storeLayer, studioLayer)
}

function layerTracking() {
  return Layer.mergeAll(
    StudioTracer.layer,
    StudioLogger.layer,
    StudioMetrics.layer,
    StudioErrors.layer,
    StudioProcess.layer,
  )
}

function layerRoutes(prefix: string) {
  return Route.layerMerge({
    [prefix as "/"]: routes,
  })
}

export function layer(options?: StudioOptions) {
  const prefix = options?.prefix ?? "/studio"
  const store = layerStore(options)
  return Layer.mergeAll(store, layerTracking().pipe(Layer.provide(store)), layerRoutes(prefix))
}
