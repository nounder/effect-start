import * as FileSystem from "./FileSystem.ts"
import * as Data from "effect/Data"
import * as Effect from "effect/Effect"
import * as Either from "effect/Either"
import * as Function from "effect/Function"
import * as Layer from "effect/Layer"
import * as Stream from "effect/Stream"
import * as NPath from "node:path"
import * as NUrl from "node:url"
import * as Development from "./_Development.ts"
import * as FileRouterCodegen from "./FileRouterCodegen.ts"
import * as NodeUtils from "./node/NodeUtils.ts"
import * as PathPattern from "./_PathPattern.ts"
import type * as System from "./System.ts"
import * as Route from "./Route.ts"
import * as RouteTree from "./RouteTree.ts"

export class FileRouterError extends Data.TaggedError("FileRouterError")<{
  reason: "Import" | "Conflict" | "FileSystem"
  cause?: unknown
  path?: string
}> {}

export type RouteModule = {
  default: Route.RouteSet.Any
}

export type LazyRouteModule = () => Promise<RouteModule>

export type FileRoutes = {
  [path: PathPattern.PathPattern]: [LazyRouteModule, ...LazyRouteModule[]]
}

export type FileRoute = {
  handle: "route" | "layer"
  // eg. `/about/route.tsx`, `/users/[userId]/route.tsx`, `/(admin)/users/route.tsx`
  modulePath: `/${string}`
  // eg. `/about`, `/users/:userId`, `/users` (groups stripped)
  routePath: PathPattern.PathPattern
}

/**
 * Routes sorted by depth, with rest parameters at the end.
 * - layer.tsx
 * - users/route.tsx
 * - users/[userId]/route.tsx
 * - [[rest]]/route.tsx
 */
export type OrderedFileRoutes = Array<FileRoute>

const ROUTE_PATH_REGEX = /^(.*\/)?(route|layer)\.(jsx?|tsx?)$/

export function parseRoute(path: string): FileRoute | null {
  const normalizedPath = path.replace(/^\/+/, "")
  const matched = normalizedPath.match(ROUTE_PATH_REGEX)
  if (!matched) {
    return null
  }

  const routeDir = matched[1]?.replace(/\/$/, "") ?? ""
  const handle = matched[2] as "route" | "layer"
  const routePathResult = PathPattern.fromFilePath(routeDir)
  if (Either.isLeft(routePathResult)) {
    return null
  }

  return {
    handle,
    modulePath: `/${normalizedPath}`,
    routePath: routePathResult.right,
  }
}

function importModule<T>(load: () => Promise<T>): Effect.Effect<T, FileRouterError> {
  return Effect.tryPromise({
    try: () => load(),
    catch: (cause) => new FileRouterError({ reason: "Import", cause }),
  })
}

/**
 * Generates a tree file that references all routes.
 */
export function layer(
  load: () => Promise<{ default: FileRoutes }>,
): Layer.Layer<Route.Routes, FileRouterError, FileSystem.FileSystem>
export function layer(options: {
  load: () => Promise<{ default: FileRoutes }>
  path: string
}): Layer.Layer<Route.Routes, FileRouterError, FileSystem.FileSystem>
export function layer(
  loadOrOptions:
    | (() => Promise<{ default: FileRoutes }>)
    | { load: () => Promise<{ default: FileRoutes }>; path: string },
) {
  const options =
    typeof loadOrOptions === "function"
      ? {
          load: loadOrOptions,
          path: NPath.join(NodeUtils.getEntrypoint(), "routes"),
        }
      : loadOrOptions
  let treePath = options.path
  if (treePath.startsWith("file://")) {
    treePath = NUrl.fileURLToPath(treePath)
  }
  if (NPath.extname(treePath) === "") {
    treePath = NPath.join(treePath, "server.gen.ts")
  }

  const routesPath = NPath.dirname(treePath)
  const treeFilename = NPath.basename(treePath)
  const relativeRoutesPath = NPath.relative(process.cwd(), routesPath)

  return Layer.scoped(
    Route.Routes,
    Effect.gen(function* () {
      // Generate routes file before loading
      yield* FileRouterCodegen.update(routesPath, treeFilename)

      // Load and build route tree
      const m = yield* importModule(options.load)
      const routeTree = yield* fromFileRoutes(m.default)

      // Watch for changes (only when Development service is available)
      yield* Function.pipe(
        Development.events,
        Stream.filter((e) => e._tag !== "Reload" && e.path.startsWith(relativeRoutesPath)),
        Stream.runForEach(() => FileRouterCodegen.update(routesPath, treeFilename)),
        Effect.fork,
      )

      return routeTree
    }),
  )
}

export function fromFileRoutes(fileRoutes: FileRoutes): Effect.Effect<RouteTree.RouteTree> {
  return Effect.gen(function* () {
    const mounts: RouteTree.InputRouteMap = {}

    for (const [path, loaders] of Object.entries(fileRoutes)) {
      const allRoutes: RouteTree.RouteTuple = [] as unknown as RouteTree.RouteTuple

      for (const loader of loaders) {
        const result = yield* Effect.either(
          Effect.tryPromise({
            try: () => loader(),
            catch: (cause) => new FileRouterError({ reason: "Import", cause, path }),
          }),
        )

        if (Either.isLeft(result)) {
          const error = result.left
          for (const route of Route.use(Route.render((): Effect.Effect<string, FileRouterError> => Effect.fail(error)))) {
            ;(allRoutes as Array<any>).push(route)
          }
        } else {
          const m = result.right
          if (Route.isRouteSet(m.default)) {
            for (const route of m.default) {
              ;(allRoutes as Array<any>).push(route)
            }
          }
        }
      }

      mounts[path as `/${string}`] = allRoutes
    }

    return RouteTree.make(mounts)
  })
}

export function walkRoutesDirectory(
  dir: string,
): Effect.Effect<
  OrderedFileRoutes,
  System.PlatformError | FileRouterError,
  FileSystem.FileSystem
> {
  return Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const files = yield* fs.readDirectory(dir, { recursive: true })

    return yield* getFileRoutes(files)
  })
}

export function getFileRoutes(
  paths: Array<string>,
): Effect.Effect<OrderedFileRoutes, FileRouterError> {
  return Effect.gen(function* () {
    const routes = paths
      .map((f) => f.match(ROUTE_PATH_REGEX))
      .filter(Boolean)
      .map((v) => {
        const path = v![0]
        try {
          return parseRoute(path)
        } catch {
          return null
        }
      })
      .filter((route): route is FileRoute => route !== null)
      .toSorted((a, b) => {
        const aDepth = a.modulePath.split("/").filter(Boolean).length - 1
        const bDepth = b.modulePath.split("/").filter(Boolean).length - 1
        const aHasRest = a.routePath.split("/").some((seg) => seg.startsWith(":") && seg.endsWith("*"))
        const bHasRest = b.routePath.split("/").some((seg) => seg.startsWith(":") && seg.endsWith("*"))

        return (
          // rest is a dominant factor (routes with rest come last)
          (+aHasRest - +bHasRest) * 1000 +
          // depth is reversed for rest
          (aDepth - bDepth) * (1 - 2 * +aHasRest) +
          // lexicographic comparison as tiebreaker
          a.modulePath.localeCompare(b.modulePath) * 0.001
        )
      })

    // Detect conflicting routes at the same path
    const routesByPath = new Map<string, Array<FileRoute>>()
    for (const route of routes) {
      const existing = routesByPath.get(route.routePath) || []
      existing.push(route)
      routesByPath.set(route.routePath, existing)
    }

    for (const [path, pathRoutes] of routesByPath) {
      const routeHandles = pathRoutes.filter((h) => h.handle === "route")

      if (routeHandles.length > 1) {
        yield* new FileRouterError({ reason: "Conflict", path })
      }
    }

    return routes
  })
}
