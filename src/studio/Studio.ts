import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as GlobalValue from "effect/GlobalValue"
import * as Layer from "effect/Layer"
import * as PubSub from "effect/PubSub"
import * as Scope from "effect/Scope"
import type * as PathPattern from "../internal/PathPattern.ts"
import * as Route from "../Route.ts"
import * as sqlBun from "../sql/bun/index.ts"
import routes from "./routes.tsx"
import * as StudioErrors from "./StudioErrors.ts"
import * as StudioLogger from "./StudioLogger.ts"
import * as StudioMetrics from "./StudioMetrics.ts"
import * as StudioProcess from "./StudioProcess.ts"
import * as StudioStore from "./StudioStore.ts"
import * as StudioTracer from "./StudioTracer.ts"

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
  const sqlLayer = Layer.effectContext(Effect.sync(() =>
    GlobalValue.globalValue(
      Symbol.for("effect-start/Studio/sql"),
      () =>
        Effect.runSync(
          Layer.buildWithScope(
            sqlBun.layer({
              adapter: "sqlite" as const,
              filename: ":memory:",
              safeIntegers: true,
            }),
            Effect.runSync(Scope.make()),
          ),
        ),
    )
  ))
  const path = options?.path ?? "/studio"
  const studio = layerStudio(options)
  return Layer
    .mergeAll(
      studio,
      layerTracking().pipe(Layer.provide(studio)),
      layerRoutes(path),
      sqlLayer,
    )
    .pipe(Layer.provide(sqlLayer))
}

function layerStudio(options?: Options) {
  return Layer
    .effect(
      Studio,
      Effect.gen(function*() {
        yield* StudioStore.setupDatabase
        const store: StudioStore.State = {
          events: yield* PubSub.unbounded<StudioStore.StudioEvent>(),
          spanCapacity: options?.spanCapacity ?? 1000,
          logCapacity: options?.logCapacity ?? 5000,
          errorCapacity: options?.errorCapacity ?? 1000,
        }
        return {
          path: options?.path ?? "/studio",
          auth: options?.auth,
          store,
        }
      }),
    )
    .pipe(Layer.orDie)
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
