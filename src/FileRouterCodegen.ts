import type { PlatformError } from "@effect/platform/Error"
import * as FileSystem from "@effect/platform/FileSystem"
import * as Effect from "effect/Effect"
import * as Function from "effect/Function"
import * as Schema from "effect/Schema"
import * as NPath from "node:path"
import * as FileRouter from "./FileRouter.ts"
import * as FileRouterPattern from "./FileRouterPattern.ts"
import * as Route from "./Route.ts"
import * as Router from "./Router.ts"
import * as SchemaExtra from "./SchemaExtra.ts"

export function validateRouteModule(
  module: unknown,
): module is FileRouter.RouteModule {
  if (typeof module !== "object" || module === null) {
    return false
  }
  if (!("default" in module)) {
    return false
  }
  return Route.isRouteSet(module.default)
}

export function generatePathParamsSchema(
  segments: ReadonlyArray<FileRouterPattern.Segment>,
): Schema.Struct<any> | null {
  const fields: Record<
    PropertyKey,
    Schema.Schema.Any | Schema.PropertySignature.All
  > = {}

  for (const segment of segments) {
    if (
      segment._tag === "ParamSegment"
      || segment._tag === "RestSegment"
    ) {
      fields[segment.name] = segment.optional
        ? Function.pipe(Schema.String, Schema.optional)
        : Schema.String
    }
  }

  if (Object.keys(fields).length === 0) {
    return null
  }

  return Schema.Struct(fields)
}

/**
 * Validates all route modules in the given route handles.
 */

export function validateRouteModules(
  routesPath: string,
  handles: FileRouter.OrderedRouteHandles,
): Effect.Effect<void, PlatformError, FileSystem.FileSystem> {
  return Effect.gen(function*() {
    const fs = yield* FileSystem.FileSystem
    const routeHandles = handles.filter(h => h.handle === "route")

    for (const handle of routeHandles) {
      const routeModulePath = NPath.resolve(routesPath, handle.modulePath)
      const expectedSchema = generatePathParamsSchema(handle.segments)

      const fileExists = yield* fs.exists(routeModulePath)
      if (!fileExists) {
        continue
      }

      const module = yield* Effect.promise(() => import(routeModulePath))

      if (!validateRouteModule(module)) {
        yield* Effect.logWarning(
          `Route module ${routeModulePath} should export default Route`,
        )
        continue
      }

      const routeSet = module.default
      const userSchema = routeSet.schema?.PathParams

      if (
        expectedSchema
        && userSchema
        && !SchemaExtra.schemaEqual(userSchema, expectedSchema)
      ) {
        const relativeFilePath = NPath.relative(process.cwd(), routeModulePath)
        yield* Effect.logError(
          `Route '${relativeFilePath}' has incorrect PathParams schema, expected schemaPathParams(${
            SchemaExtra.formatSchemaCode(expectedSchema)
          })`,
        )
      }
    }
  })
}

export function generateCode(
  handles: FileRouter.OrderedRouteHandles,
): string {
  const routerModuleId = "effect-start"

  // Group routes by path to find layers
  const routesByPath = new Map<string, {
    route?: FileRouter.RouteHandle
    layers: FileRouter.RouteHandle[]
  }>()

  for (const handle of handles) {
    const existing = routesByPath.get(handle.routePath) || { layers: [] }
    if (handle.handle === "route") {
      existing.route = handle
    } else if (handle.handle === "layer") {
      existing.layers.push(handle)
    }
    routesByPath.set(handle.routePath, existing)
  }

  // Generate route definitions
  const routes: string[] = []

  // Helper to check if layer's path is an ancestor of route's path
  const layerMatchesRoute = (
    layer: FileRouter.RouteHandle,
    route: FileRouter.RouteHandle,
  ): boolean => {
    // Get the directory of the layer (strip the filename like layer.tsx)
    const layerDir = layer.modulePath.replace(/\/?(layer)\.(tsx?|jsx?)$/, "")

    // Layer at root (empty layerDir) applies to all routes
    if (layerDir === "") return true

    // Route's modulePath must start with the layer's directory
    return route.modulePath.startsWith(layerDir + "/")
  }

  // Find layers for each route by walking up the path hierarchy
  for (const [path, { route }] of routesByPath) {
    if (!route) continue // Skip paths that only have layers

    // Collect all parent layers that match the route's groups
    const allLayers: FileRouter.RouteHandle[] = []
    let currentPath = path

    while (true) {
      const pathData = routesByPath.get(currentPath)
      if (pathData?.layers) {
        const matchingLayers = pathData.layers.filter(layer =>
          layerMatchesRoute(layer, route)
        )
        allLayers.unshift(...matchingLayers)
      }

      if (currentPath === "/") break

      // Move to parent path
      const parentPath = currentPath.substring(0, currentPath.lastIndexOf("/"))
      currentPath = parentPath || "/"
    }

    // Generate layers array
    const layersCode = allLayers.length > 0
      ? `\n    layers: [\n      ${
        allLayers.map(layer => `() => import("./${layer.modulePath}")`).join(
          ",\n      ",
        )
      },\n    ],`
      : ""

    const routeCode = `  {
    path: "${path}",
    load: () => import("./${route.modulePath}"),${layersCode}
  },`

    routes.push(routeCode)
  }

  const header = `/**
 * Auto-generated by effect-start.
 */`

  const routesArray = routes.length > 0
    ? `[\n${routes.join("\n")}\n]`
    : "[]"

  return `${header}

export const routes = ${routesArray} as const
`
}

/**
 * Updates the manifest file only if the generated content differs from the existing file.
 * This prevents infinite loops when watching for file changes.
 */
export function update(
  routesPath: string,
  manifestPath = "manifest.ts",
): Effect.Effect<void, PlatformError, FileSystem.FileSystem> {
  return Effect.gen(function*() {
    manifestPath = NPath.resolve(routesPath, manifestPath)

    const fs = yield* FileSystem.FileSystem
    const files = yield* fs.readDirectory(routesPath, { recursive: true })
    const handles = FileRouter.getRouteHandlesFromPaths(files)

    // Validate route modules
    yield* validateRouteModules(routesPath, handles)

    const newCode = generateCode(handles)

    // Check if file exists and content differs
    const existingCode = yield* fs
      .readFileString(manifestPath)
      .pipe(Effect.catchAll(() => Effect.succeed(null)))

    if (existingCode !== newCode) {
      yield* Effect.logDebug(`Updating file routes manifest: ${manifestPath}`)
      yield* fs.writeFileString(manifestPath, newCode)
    } else {
      yield* Effect.logDebug(`File routes manifest unchanged: ${manifestPath}`)
    }
  })
}

export function dump(
  routesPath: string,
  manifestPath = "manifest.ts",
): Effect.Effect<void, PlatformError, FileSystem.FileSystem> {
  return Effect.gen(function*() {
    manifestPath = NPath.resolve(routesPath, manifestPath)

    const fs = yield* FileSystem.FileSystem
    const files = yield* fs.readDirectory(routesPath, { recursive: true })
    const handles = FileRouter.getRouteHandlesFromPaths(files)

    // Validate route modules
    yield* validateRouteModules(routesPath, handles)

    const code = generateCode(handles)

    yield* Effect.logDebug(`Generating file routes manifest: ${manifestPath}`)

    yield* fs.writeFileString(
      manifestPath,
      code,
    )
  })
}
