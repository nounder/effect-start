import * as HttpApp from "@effect/platform/HttpApp"
import * as HttpRouter from "@effect/platform/HttpRouter"
import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import { pipe } from "effect/Function"
import * as Layer from "effect/Layer"
import * as Endpoint from "./Endpoint"
import * as FileHttpRouter from "./FileHttpRouter"

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

export type ServerHandle<A> =
  | HttpApp.Default<any, any>
  | Endpoint.EndpointHandle<A, any, any>

export type ServerModule =
  & {
    [K in ServerMethod]?: ServerHandle<any>
  }
  & {
    default?: ServerHandle<any>
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

export class Router extends Context.Tag("effect-bundler/Router")<
  Router,
  RouterContext
>() {}

export function layer(
  load: () => Promise<RouteManifest>,
): Layer.Layer<Router, never, never> {
  return Layer.effect(
    Router,
    Effect.gen(function*() {
      const importedModule = yield* pipe(
        Effect.promise(() => load()),
        Effect.orDie,
      )

      const manifest: RouteManifest = {
        Pages: importedModule.Pages,
        Layouts: importedModule.Layouts,
        Servers: importedModule.Servers,
      }

      const httpRouter = yield* FileHttpRouter.make(manifest.Servers)
      return {
        ...manifest,
        httpRouter,
      }
    }),
  )
}
