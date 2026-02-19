import * as FileSystem from "./FileSystem.ts"
import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"
import * as NPath from "node:path"
import * as FileRouter from "./FileRouter.ts"
import * as PathPattern from "./_PathPattern.ts"
import * as SchemaExtra from "./_SchemaExtra.ts"

export function validateRouteModule(module: unknown): module is FileRouter.RouteModule {
  if (typeof module !== "object" || module === null) {
    return false
  }

  if (!("default" in module)) {
    return false
  }

  // TODO: verify we're exporting a proper shape
  return true
}

export function generatePathParamsSchema(path: PathPattern.PathPattern): Schema.Struct<any> | null {
  const fields: Record<PropertyKey, Schema.Schema.Any | Schema.PropertySignature.All> = {}

  for (const param of PathPattern.params(path)) {
    fields[param.name] = param.optional ? Schema.optional(Schema.String) : Schema.String
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
  path: string,
  routes: FileRouter.OrderedFileRoutes,
): Effect.Effect<void, FileRouter.FileRouterError, FileSystem.FileSystem> {
  return Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const routeHandles = routes.filter((h) => h.handle === "route")

    for (const handle of routeHandles) {
      const routeModulePath = NPath.resolve(path, handle.modulePath)
      const expectedSchema = generatePathParamsSchema(handle.routePath)

      const fileExists = yield* fs
        .exists(routeModulePath)
        .pipe(Effect.catchAll(() => Effect.succeed(false)))
      if (!fileExists) {
        continue
      }

      const module = yield* Effect.tryPromise({
        try: () => import(routeModulePath),
        catch: (cause) =>
          new FileRouter.FileRouterError({
            reason: "Import",
            cause,
            path: routeModulePath,
          }),
      })

      if (!validateRouteModule(module)) {
        yield* Effect.logWarning(`Route module ${routeModulePath} should export default Route`)
        continue
      }

      const routeSet = module.default
      // extract user schema
      const userSchema = undefined

      if (expectedSchema && userSchema && !SchemaExtra.schemaEqual(userSchema, expectedSchema)) {
        const relativeFilePath = NPath.relative(process.cwd(), routeModulePath)
        yield* Effect.logError(
          `Route '${relativeFilePath}' has incorrect PathParams schema, expected schemaPathParams(${SchemaExtra.formatSchemaCode(
            expectedSchema,
          )})`,
        )
      }
    }
  })
}

export function generateCode(fileRoutes: FileRouter.OrderedFileRoutes): string | null {
  // Group routes by path to find layers
  const routesByPath = new Map<
    string,
    {
      route?: FileRouter.FileRoute
      layers: Array<FileRouter.FileRoute>
    }
  >()

  for (const fileRoute of fileRoutes) {
    const existing = routesByPath.get(fileRoute.routePath) || { layers: [] }
    if (fileRoute.handle === "route") {
      existing.route = fileRoute
    } else if (fileRoute.handle === "layer") {
      existing.layers.push(fileRoute)
    }
    routesByPath.set(fileRoute.routePath, existing)
  }

  // Helper to check if layer's path is an ancestor of route's path
  const layerMatchesRoute = (layer: FileRouter.FileRoute, route: FileRouter.FileRoute): boolean => {
    const layerDir = layer.modulePath.replace(/\/(layer)\.(tsx?|jsx?)$/, "")
    if (layerDir === "/") return true
    return route.modulePath.startsWith(layerDir + "/")
  }

  // Build entries for each route path
  const entries: Array<{ path: string; loaders: Array<string> }> = []

  for (const [path, { route }] of routesByPath) {
    if (!route) continue

    // Collect all parent layers that match the route's groups
    const allLayers: Array<FileRouter.FileRoute> = []
    let currentPath = path

    while (true) {
      const pathData = routesByPath.get(currentPath)
      if (pathData?.layers) {
        const matchingLayers = pathData.layers.filter((layer) => layerMatchesRoute(layer, route))
        allLayers.unshift(...matchingLayers)
      }

      if (currentPath === "/") break

      const parentPath = currentPath.substring(0, currentPath.lastIndexOf("/"))
      currentPath = parentPath || "/"
    }

    // Order: route first, then layers from innermost to outermost
    const loaders: Array<string> = [
      `() => import(".${route.modulePath}")`,
      ...allLayers.reverse().map((layer) => `() => import(".${layer.modulePath}")`),
    ]

    entries.push({ path, loaders })
  }

  // No routes found - don't create file
  if (entries.length === 0) {
    return null
  }

  const routeEntries = entries
    .map((v) => {
      const loadersCode = v.loaders.join(",\n    ")
      return `  "${v.path}": [\n    ${loadersCode},\n  ]`
    })
    .join(",\n")

  return `/**
 * Auto-generated by effect-start on startup and changes. Do not edit manually.
 */

export default {
${routeEntries},
} satisfies import("effect-start/FileRouter").FileRoutes
`
}

/**
 * Updates the tree file only if the generated content differs from the existing file.
 * This prevents infinite loops when watching for file changes.
 */
export function update(
  routesPath: string,
  treePath = "server.gen.ts",
): Effect.Effect<void, FileRouter.FileRouterError, FileSystem.FileSystem> {
  return Effect.gen(function* () {
    treePath = NPath.resolve(routesPath, treePath)

    const fs = yield* FileSystem.FileSystem
    const files = yield* fs.readDirectory(routesPath, { recursive: true }).pipe(
      Effect.mapError(
        (cause) =>
          new FileRouter.FileRouterError({
            reason: "FileSystem",
            cause,
            path: routesPath,
          }),
      ),
    )
    const fileRoutes = yield* FileRouter.getFileRoutes(files)

    // Validate route modules
    yield* validateRouteModules(routesPath, fileRoutes)

    const newCode = generateCode(fileRoutes)

    // Check if file exists (ok to fail - means file doesn't exist)
    const existingCode = yield* fs
      .readFileString(treePath)
      .pipe(Effect.catchAll(() => Effect.succeed(null)))

    // No routes found
    if (newCode === null) {
      // If gen file exists, write empty export
      if (existingCode !== null) {
        const emptyCode = "export default {}\n"
        if (existingCode !== emptyCode) {
          yield* Effect.logDebug(`Clearing file routes tree: ${treePath}`)
          yield* fs.writeFileString(treePath, emptyCode).pipe(
            Effect.mapError(
              (cause) =>
                new FileRouter.FileRouterError({
                  reason: "FileSystem",
                  cause,
                  path: treePath,
                }),
            ),
          )
        }
      }
      return
    }

    // Write if content differs
    if (existingCode !== newCode) {
      yield* Effect.logDebug(`Updating file routes tree: ${treePath}`)
      yield* fs.writeFileString(treePath, newCode).pipe(
        Effect.mapError(
          (cause) =>
            new FileRouter.FileRouterError({
              reason: "FileSystem",
              cause,
              path: treePath,
            }),
        ),
      )
    } else {
      yield* Effect.logDebug(`File routes tree unchanged: ${treePath}`)
    }
  })
}

export function dump(
  routesPath: string,
  treePath = "server.gen.ts",
): Effect.Effect<void, FileRouter.FileRouterError, FileSystem.FileSystem> {
  return Effect.gen(function* () {
    treePath = NPath.resolve(routesPath, treePath)

    const fs = yield* FileSystem.FileSystem
    const files = yield* fs.readDirectory(routesPath, { recursive: true }).pipe(
      Effect.mapError(
        (cause) =>
          new FileRouter.FileRouterError({
            reason: "FileSystem",
            cause,
            path: routesPath,
          }),
      ),
    )
    const fileRoutes = yield* FileRouter.getFileRoutes(files)

    // Validate route modules
    yield* validateRouteModules(routesPath, fileRoutes)

    const code = generateCode(fileRoutes)

    // No routes found - don't create file
    if (code === null) {
      yield* Effect.logDebug(`No routes found, skipping: ${treePath}`)
      return
    }

    yield* Effect.logDebug(`Generating file routes tree: ${treePath}`)

    yield* fs.writeFileString(treePath, code).pipe(
      Effect.mapError(
        (cause) =>
          new FileRouter.FileRouterError({
            reason: "FileSystem",
            cause,
            path: treePath,
          }),
      ),
    )
  })
}
