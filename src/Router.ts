import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Function from "effect/Function"
import * as Layer from "effect/Layer"
import * as FileRouter from "./FileRouter.ts"
import * as Route from "./Route"

export type ServerModule = {
  default: Route.RouteSet.Default
}

export type LazyRoute = {
  path: `/${string}`
  load: () => Promise<ServerModule>
  layers?: ReadonlyArray<() => Promise<unknown>>
}

export type RouterManifest = {
  routes: readonly LazyRoute[]
  layers?: any[]
}

export type RouterContext = RouterManifest

export class Router extends Context.Tag("effect-start/Router")<
  Router,
  RouterContext
>() {}

export function layer(
  manifest: RouterManifest,
): Layer.Layer<Router, never, never> {
  return Layer.effect(
    Router,
    Effect.gen(function*() {
      return {
        ...manifest,
      }
    }),
  )
}

export const layerFiles = FileRouter.layer

export function layerPromise(
  load: () => Promise<RouterManifest>,
): Layer.Layer<Router, never, never> {
  return Layer.unwrapEffect(
    Effect.gen(function*() {
      const importedModule = yield* Function.pipe(
        Effect.promise(() => load()),
        Effect.orDie,
      )

      return layer(importedModule)
    }),
  )
}
