import {
  createRootRoute,
  createRoute,
  Outlet,
} from "@tanstack/react-router"
import {
  Data,
  Effect,
  Layer,
  pipe,
  Stream,
} from "effect"
import {
  FileRouter,
} from "effect-bundler"
import {
  watchFileChanges,
} from "effect-bundler/files"
import React from "react"
import * as TanstackRouterCodegen from "./TanstackRouterCodegen.ts"

export class TanstackRouterError
  extends Data.TaggedError("TanstackRouterError")<{
    message: string
    cause?: unknown
  }>
{}

type RouteModules = {
  [path: string]: () =>
    | Promise<{
      default: any
    }>
    | {
      default: any
    }
}

export function layer() {
  const root = process.cwd() + "src/routes"

  return Layer.scopedDiscard(
    Effect.gen(function*() {
      yield* TanstackRouterCodegen.dump()

      yield* pipe(
        watchFileChanges(root),
        Stream.runForEach(() => TanstackRouterCodegen.dump()),
        Effect.fork,
      )
    }),
  )
}

export function makeRootRoute(
  paths: RouteModules,
) {
  const routes = FileRouter.getRouteHandlesFromPaths(Object.keys(paths))

  const rootRoute = createRootRoute({
    component: () => React.createElement(Outlet),
  })

  const childRoutes = convertRoutesToTanstackRoutes(
    routes,
    paths,
    rootRoute as any,
  )

  return rootRoute.addChildren(childRoutes as any)
}

function convertRoutesToTanstackRoutes(
  routes: FileRouter.RouteHandle[],
  modules: RouteModules,
  rootRoute: any,
): any[] {
  const childRoutes: any[] = []

  // Filter to only page routes
  const pageRoutes = routes.filter(route => route.type === "PageHandle")

  for (const route of pageRoutes) {
    const routePath = route.routePath

    const tanstackRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: routePath,
      component: () => {
        let Component: any = null
        const moduleResult = modules[route.modulePath]()

        if (moduleResult instanceof Promise) {
          Component = React.lazy(() => moduleResult)
          return React.createElement(
            React.Suspense,
            { fallback: null },
            React.createElement(Component),
          )
        } else {
          Component = moduleResult.default
          return React.createElement(Component)
        }
      },
      loader: async () => {
        const moduleResult = modules[route.modulePath]()
        const module = moduleResult instanceof Promise
          ? await moduleResult
          : moduleResult
        return module
      },
    })

    childRoutes.push(tanstackRoute)
  }

  return childRoutes
}
