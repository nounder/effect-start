import type * as HttpApp from "@effect/platform/HttpApp"
import * as HttpRouter from "@effect/platform/HttpRouter"
import * as Path from "@effect/platform/Path"
import * as Effect from "effect/Effect"
import { tagged } from "./Bundle.ts"

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

export type ServerHandle = HttpApp.Default<any, any>

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

export class Router
  extends Effect.Service<Router>()("nounder/effect-bundler/Router", {
    effect: Effect.gen(function*() {
      const router = HttpRouter.empty

      return {
        router,
      }
    }),
  })
{}
