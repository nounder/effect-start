import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as PubSub from "effect/PubSub"
import * as Route from "../Route.ts"
import * as sqlBun from "../sql/bun/index.ts"
import * as StudioErrors from "./StudioErrors.ts"
import * as StudioLogger from "./StudioLogger.ts"
import * as StudioMetrics from "./StudioMetrics.ts"
import * as StudioProcess from "./StudioProcess.ts"
import * as StudioStore from "./StudioStore.ts"
import * as StudioTracer from "./StudioTracer.ts"
import routes from "./routes/tree.ts"
import * as PathPattern from "../internal/PathPattern.ts"

type AuthOptions = {
  readonly type: "basic"
  readonly username: string
  readonly password: string
}

export class Studio extends Context.Tag("effect-start/Studio")<
  Studio,
  {
    readonly path: string
    readonly auth: AuthOptions | undefined
    readonly store: StudioStore.State
  }
>() {}

interface Options {
  readonly path?: PathPattern.PathPattern
  readonly auth?: AuthOptions
  readonly spanCapacity?: number
  readonly logCapacity?: number
  readonly errorCapacity?: number
}

export function layer(options?: Options) {
  const sqlLayer = sqlBun
    .layer({ adapter: "sqlite" as const, filename: ":memory:" })
    .pipe(Layer.orDie)
  const path = options?.path ?? "/studio"
  const studio = layerStudio(options)
  return Layer.mergeAll(
    studio,
    layerTracking().pipe(Layer.provide(studio)),
    layerRoutes(path),
    sqlLayer,
  ).pipe(Layer.provide(sqlLayer))
}

function layerStudio(options?: Options) {
  return Layer.effect(
    Studio,
    Effect.gen(function* () {
      yield* StudioStore.setupDatabase
      const store: StudioStore.State = {
        events: yield* PubSub.unbounded<StudioStore.StudioEvent>(),
        spanCapacity: options?.spanCapacity ?? 1000,
        logCapacity: options?.logCapacity ?? 5000,
        errorCapacity: options?.errorCapacity ?? 1000,
        metrics: [] as Array<StudioStore.MetricSnapshot>,
        process: undefined,
      }
      return {
        path: options?.path ?? "/studio",
        auth: options?.auth,
        store,
      }
    }),
  ).pipe(Layer.orDie)
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

function layerRoutes(path: string) {
  return Route.layerMerge({
    [path as "/"]: routes,
  })
}
