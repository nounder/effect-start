import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Function from "effect/Function"
import * as Layer from "effect/Layer"
import * as FileRouter from "./FileRouter.ts"
import * as Route from "./Route"

export const ServerMethods = [
  "GET",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
  "OPTIONS",
  "HEAD",
] as const

export type ServerMethod = (typeof ServerMethods)[number]

export type ServerModule = {
  default: Route.RouteSet.Default
}

export type ServerRoute = {
  path: `/${string}`
  segments: readonly FileRouter.Segment[]
  load: () => Promise<ServerModule>
}

export type RouteManifest = {
  modules: readonly FileRouter.RouteModule[]
  layers?: any[]
}

export type RouterContext = RouteManifest

export class Router extends Context.Tag("effect-start/Router")<
  Router,
  RouterContext
>() {}

export function layer(
  manifest: RouteManifest,
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
  load: () => Promise<RouteManifest>,
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
