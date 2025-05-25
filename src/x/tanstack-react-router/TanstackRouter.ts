import {
  type AnyRoute,
  createRootRoute,
  createRoute,
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

const RoutesDir = import.meta.dir + "/routes"

export class TanstackRouterError
  extends Data.TaggedError("TanstackRouterError")<{
    message: string
    cause?: unknown
  }>
{}

type RouteModules = {
  [path: string]: () => Promise<{
    default: any
  }>
}

export function generateRouteTree(paths: RouteModules) {
  const routes = FileRouter.getDirectoryRoutesFromPaths(Object.keys(paths))

  // Create the actual root route using TanStack Router API
  const rootRoute = createRootRoute({
    component: () => null, // Default component, can be overridden
  })

  // Convert routes to TanStack routes and build the tree
  const childRoutes = convertRoutesToTanstackRoutes(
    routes,
    paths,
    rootRoute as any,
  )

  return rootRoute.addChildren(childRoutes as any) as any
}

export function layer() {
  const root = process.cwd()

  return Layer.scopedDiscard(
    Effect.gen(function*() {
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
      )
    }),
  )
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
      component: () => null, // Default component
      loader: async () => {
        const module = await modules[route.modulePath]()
        return module
      },
    })

    childRoutes.push(tanstackRoute)
  }

  return childRoutes
}

function generateRouteId(path: string): string {
  if (path === "/" || path === "") return "index"
  // Handle splat routes specially
  if (path === "/$") return "_"
  // Remove leading slash and replace all slashes and $ with underscores
  const id = path.replace(/^\//, "").replace(/[\/$]/g, "_")
  // For splat routes ending with $, we want to keep the trailing underscore(s)
  // Only remove trailing underscores if the path doesn't end with $
  if (!path.endsWith("$")) {
    return id.replace(/_+$/, "") || "index"
  }
  return id || "index"
}
