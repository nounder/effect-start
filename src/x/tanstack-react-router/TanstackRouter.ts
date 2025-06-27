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
import { FileRouter } from "effect-bundler"
import React from "react"
import * as FileSystemExtra from "../../FileSystemExtra.ts"
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

// TODO: throw error if routes directory is invalid.
//  currently it just logs an error and continues.
export function layer() {
  const routesDir = process.cwd() + "/src/routes"
  const genFile = ".pages.gen.ts"
  const path = `${routesDir}/${genFile}`

  return Layer.scopedDiscard(
    Effect.gen(function*() {
      yield* TanstackRouterCodegen.dump(path)

      const stream = pipe(
        FileSystemExtra.watchSource(routesDir),
        Stream.onError((e) => Effect.logError(e)),
      )

      yield* pipe(
        stream,
        // filter out edits to gen file
        Stream.filter(e => e.type === "Change" && e.path !== genFile),
        Stream.runForEach(() => TanstackRouterCodegen.dump(path)),
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
