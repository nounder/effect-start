import * as HttpApp from "@effect/platform/HttpApp"
import * as HttpRouter from "@effect/platform/HttpRouter"
import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Function from "effect/Function"
import * as Layer from "effect/Layer"
import * as FileHttpRouter from "./FileHttpRouter.ts"
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

export type ServerHandle =
  | HttpApp.Default<any, any>
  | Route.Route

export type ServerModule =
  & {
    [K in ServerMethod]?: ServerHandle
  }
  & {
    default?: ServerHandle
  }

export type ServerRoute = {
  path: `/${string}`
  load: () => Promise<ServerModule>
}

export type LayoutModule<Component = any, Children = Component> = {
  default: (props: {
    children: Children
  }) => Component
}

export type LayoutRoute = {
  path: `/${string}`
  parent?: LayoutRoute
  load: () => Promise<LayoutModule>
}

export type PageModule<Component = any> = {
  default: (props: {}) => Component
}

export type PageRoute = {
  path: `/${string}`
  parent?: LayoutRoute
  load: () => Promise<PageModule>
}

export type PageRoutes = ReadonlyArray<PageRoute>
export type LayoutRoutes = ReadonlyArray<LayoutRoute>
export type ServerRoutes = ReadonlyArray<ServerRoute>

export type RouteManifest = {
  Pages: PageRoutes
  Layouts: LayoutRoutes
  Servers: ServerRoutes
}

export type RouterContext =
  & RouteManifest
  & {
    httpRouter: HttpRouter.HttpRouter
  }

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
      const httpRouter = yield* FileHttpRouter.make(manifest.Servers)
      return {
        ...manifest,
        httpRouter,
      }
    }),
  )
}

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
