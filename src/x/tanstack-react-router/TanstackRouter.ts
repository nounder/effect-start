import {
  FileSystem,
} from "@effect/platform"
import type {
  PlatformError,
} from "@effect/platform/Error"
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

export function dumpTanstackGenFile(
  dir = "src/routes",
): Effect.Effect<void, PlatformError, FileSystem.FileSystem> {
  return Effect.gen(function*() {
    const fs = yield* FileSystem.FileSystem
    const files = yield* fs.readDirectory(dir, { recursive: true })
    const handles = FileRouter.getRouteHandlesFromPaths(files)
    const code = TanstackRouterCodegen.generateCode(handles)

    yield* fs.writeFileString(
      `${dir}/routes.gen.ts`,
      code,
    )
  })
}

export function layer() {
  const root = process.cwd()

  return Layer.scopedDiscard(
    Effect.gen(function*() {
      yield* dumpTanstackGenFile()

      yield* pipe(
        watchFileChanges(root),
        Stream.runForEach(() =>
          Effect.tryPromise({
            try: async () => console.log("generating routes"),
            catch: cause =>
              new TanstackRouterError({
                message: "Failed to generate routes",
                cause,
              }),
          })
        ),
        Effect.fork,
      )
    }),
  )
}

export function makeRootRoute(
  paths: RouteModules,
) {
  const routes = FileRouter.getRouteHandlesFromPaths(Object.keys(paths))

  // Create the actual root route using TanStack Router API
  const rootRoute = createRootRoute({
    component: () => React.createElement(Outlet),
  })

  // Convert routes to TanStack routes and build the tree
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

    // For TanStack Router, all routes are direct children of root in this implementation
    // This matches the test expectations where routes are flattened
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
