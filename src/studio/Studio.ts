import * as Deferred from "effect/Deferred"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as PubSub from "effect/PubSub"
import * as Queue from "effect/Queue"
import type * as PathPattern from "../internal/PathPattern.ts"
import * as Route from "../Route.ts"
import * as StudioContext from "./internal/StudioContext.ts"
import * as StudioSql from "./internal/StudioSql.ts"
import routes from "./routes.tsx"
import * as StudioLogger from "./StudioLogger.ts"
import * as StudioMetrics from "./StudioMetrics.ts"
import * as StudioProcess from "./StudioProcess.ts"
import * as StudioStore from "./StudioStore.ts"
import * as StudioTracer from "./StudioTracer.ts"

export {
  Studio,
} from "./internal/StudioContext.ts"

interface Options {
  readonly path?: PathPattern.PathPattern
  readonly auth?: StudioContext.AuthOptions
  readonly spanCapacity?: number
  readonly logCapacity?: number
  readonly errorCapacity?: number
}

export function layer(options?: Options) {
  const path = options?.path ?? "/studio"
  const studio = layerStudio(options)
  return Layer
    .mergeAll(
      studio,
      layerTracking().pipe(Layer.provide(studio)),
      layerRoutes(path),
      StudioSql.layer,
    )
    .pipe(Layer.provide(StudioSql.layer))
}

function layerStudio(options?: Options) {
  return Layer
    .effect(
      StudioContext.Studio,
      Effect.gen(function*() {
        yield* StudioStore.setupDatabase
        const store: StudioStore.State = {
          events: yield* PubSub.unbounded<StudioStore.StudioEvent>(),
          writes: yield* Queue.unbounded<StudioStore.Write>(),
          spanCapacity: options?.spanCapacity ?? 1000,
          logCapacity: options?.logCapacity ?? 5000,
          errorCapacity: options?.errorCapacity ?? 1000,
        }
        yield* Effect.forkScoped(
          Queue.take(store.writes).pipe(
            Effect.flatMap((write) => Effect.catchCause(write, () => Effect.void)),
            Effect.forever,
            Effect.withTracerEnabled(false),
          ),
        )
        // Finalizers are LIFO, so this barrier runs before forkScoped interrupts
        // the worker and preserves telemetry queued by downstream finalizers.
        yield* Effect.addFinalizer(() =>
          Effect
            .gen(function*() {
              const done = yield* Deferred.make<void>()
              yield* Queue.offer(store.writes, Deferred.succeed(done, undefined))
              yield* Deferred.await(done)
            })
            .pipe(Effect.withTracerEnabled(false))
        )
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
    StudioProcess.layer,
  )
}

function layerRoutes(path: string) {
  return Route.layerMerge({
    [path as "/"]: routes,
  })
}
