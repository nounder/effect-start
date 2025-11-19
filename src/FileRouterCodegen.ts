import * as FileSystem from "@effect/platform/FileSystem"
import type { PlatformError } from "@effect/platform/Error"
import * as Effect from "effect/Effect"
import * as Function from "effect/Function"
import * as Schema from "effect/Schema"
import * as NPath from "node:path"
import * as FileRouter from "./FileRouter.ts"
import * as Route from "./Route.ts"

export function validateRouteModule(
  module: unknown,
): boolean {
  if (typeof module !== "object" || module === null) {
    return false
  }
  if (!("default" in module)) {
    return false
  }
  return Route.isRouteSet(module.default)
}

export function createRoutePathParamsSchema(
  segments: readonly FileRouter.Segment[],
): Schema.Struct<any> | undefined {
  const fields: Record<
    string,
    Schema.Schema.Any | Schema.PropertySignature.All
  > = {}

  for (const seg of segments) {
    if ("param" in seg) {
      fields[seg.param] = Schema.String
    } else if ("rest" in seg) {
      fields[seg.rest] = seg.optional
        ? Function.pipe(Schema.String, Schema.optional)
        : Schema.String
    }
  }

  if (Object.keys(fields).length === 0) {
    return undefined
  }

  return Schema.Struct(fields)
}

export function areStructSchemasEqual(
  a: Schema.Struct<any> | undefined,
  b: Schema.Struct<any> | undefined,
): boolean {
  if (!a && !b) return true
  if (!a || !b) return false

  const aFields = a.fields
  const bFields = b.fields

  const aKeys = Object.keys(aFields)
  const bKeys = Object.keys(bFields)

  if (aKeys.length !== bKeys.length) return false

  for (const key of aKeys) {
    if (!(key in bFields)) return false

    const aField = aFields[key]
    const bField = bFields[key]

    if (Schema.isSchema(aField) && Schema.isSchema(bField)) {
      if (aField.ast !== bField.ast) {
        return false
      }
    }
  }

  return true
}

/**
 * Validates all route modules in the given route handles.
 */
export function validateRouteModules(
  routesPath: string,
  handles: FileRouter.OrderedRouteHandles,
): Effect.Effect<void, never, never> {
  return Effect.gen(function*() {
    const routeHandles = handles.filter(h => h.handle === "route")

    for (const handle of routeHandles) {
      const routeModulePath = NPath.resolve(routesPath, handle.modulePath)

      const pathSegments = handle.segments.filter(seg => !("handle" in seg))
      const routePathParams = createRoutePathParamsSchema(pathSegments)

      yield* Effect
        .tryPromise({
          try: async () => import(routeModulePath),
          catch: (error) =>
            Effect.logWarning(
              `Failed to validate route module ${routeModulePath}: ${error}`,
            ),
        })
        .pipe(
          Effect.catchAll((logEffect) => logEffect),
          Effect.tap((module) => {
            if (!validateRouteModule(module)) {
              return Effect.logWarning(
                `Route module ${routeModulePath} should export default Route`,
              )
            }

            const routeSet = module.default as Route.RouteSet.Default

            if (routePathParams) {
              const existingPathParams = routeSet.schema.PathParams

              if (existingPathParams) {
                if (!areStructSchemasEqual(existingPathParams, routePathParams)) {
                  return Effect.logError(
                    `Route ${handle.routePath} (${routeModulePath}): PathParams schema mismatch. Expected schema based on route path params, but found different schema. Please update the route to use .schemaPathParams() with the correct schema.`,
                  )
                }
              } else {
                return Effect.logWarning(
                  `Route ${handle.routePath} (${routeModulePath}): Missing PathParams schema. Consider adding .schemaPathParams() to define path parameter types.`,
                )
              }
            }

            return Effect.void
          }),
        )
    }
  })
}

/**
 * Converts a segment to RouteModuleSegment format
 */
function segmentToModuleSegment(segment: FileRouter.Segment): string | null {
  if ("literal" in segment) {
    return `{ literal: "${segment.literal}" }`
  }
  if ("group" in segment) {
    return `{ group: "${segment.group}" }`
  }
  if ("param" in segment) {
    return segment.optional
      ? `{ param: "${segment.param}", optional: true }`
      : `{ param: "${segment.param}" }`
  }
  if ("rest" in segment) {
    return segment.optional
      ? `{ rest: "${segment.rest}", optional: true }`
      : `{ rest: "${segment.rest}" }`
  }
  return null
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

  // Generate module definitions
  const modules: string[] = []

  // Helper to check if layer's path is an ancestor of route's path
  const layerMatchesRoute = (
    layer: FileRouter.RouteHandle,
    route: FileRouter.RouteHandle,
  ): boolean => {
    // Exclude handle segment (last segment) from comparison
    const layerLength = layer.segments.length - 1
    const routeLength = route.segments.length - 1

    // Layer's segments must be a prefix of route's segments
    if (layerLength > routeLength) {
      return false
    }

    for (let i = 0; i < layerLength; i++) {
      if (!FileRouter.isSegmentEqual(layer.segments[i], route.segments[i])) {
        return false
      }
    }

    return true
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

    // Generate segments array
    const pathSegments = route.segments.filter(seg => !("handle" in seg))
    const segmentsCode = pathSegments
      .map(segmentToModuleSegment)
      .filter(Boolean)
      .join(",\n      ") + (pathSegments.length > 0 ? "," : "")

    const segmentsArray = segmentsCode
      ? `[\n      ${segmentsCode}\n    ]`
      : "[]"

    // Generate layers array
    const layersCode = allLayers.length > 0
      ? `\n    layers: [\n      ${
        allLayers.map(layer => `() => import("./${layer.modulePath}")`).join(
          ",\n      ",
        )
      },\n    ],`
      : ""

    const moduleCode = `  {
    path: "${path}",
    segments: ${segmentsArray},
    load: () => import("./${route.modulePath}"),${layersCode}
  },`

    modules.push(moduleCode)
  }

  const header = `/**
 * Auto-generated by effect-start.
 */`

  const modulesArray = modules.length > 0
    ? `[\n${modules.join("\n")}\n]`
    : "[]"

  return `${header}

import type { Router } from "${routerModuleId}"

export const modules = ${modulesArray} as const
`
}

/**
 * Updates the manifest file only if the generated content differs from the existing file.
 * This prevents infinite loops when watching for file changes.
 */
export function update(
  routesPath: string,
  manifestPath = "_manifest.ts",
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
  manifestPath = "_manifest.ts",
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
