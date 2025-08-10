import { FileSystem } from "@effect/platform"
import type { PlatformError } from "@effect/platform/Error"
import { Effect } from "effect"
import * as NPath from "node:path"
import * as FileRouter from "./FileRouter.ts"

const HTTP_VERBS = [
  "GET",
  "POST",
  "PUT",
  "DELETE",
  "PATCH",
  "HEAD",
  "OPTIONS",
] as const

const HANDLE_PREFIX_MAP: Record<FileRouter.RouteHandle["type"], string> = {
  LayoutHandle: "layout",
  PageHandle: "page",
  ServerHandle: "server",
} as const

export function getHandlePrefix(
  handleType: FileRouter.RouteHandle["type"],
): string {
  return HANDLE_PREFIX_MAP[handleType]
}

export function validateServerModule(
  module: Record<string, unknown>,
): boolean {
  const hasHttpVerb = HTTP_VERBS.some(verb => verb in module)
  const hasDefault = "default" in module
  return hasHttpVerb || hasDefault
}

/**
 * Validates all server modules in the given route handles.
 */
export function validateServerModules(
  routesPath: string,
  handles: FileRouter.OrderedRouteHandles,
): Effect.Effect<void, never, never> {
  return Effect.gen(function*() {
    const serverHandles = handles.filter(h => h.type === "ServerHandle")

    for (const handle of serverHandles) {
      const serverModulePath = NPath.resolve(routesPath, handle.modulePath)
      yield* Effect
        .tryPromise({
          try: async () => import(serverModulePath),
          catch: (error) =>
            Effect.logWarning(
              `Failed to validate server module ${serverModulePath}: ${error}`,
            ),
        })
        .pipe(
          Effect.catchAll((logEffect) => logEffect),
          Effect.tap((module) => {
            if (!validateServerModule(module)) {
              return Effect.logWarning(
                `Server module ${serverModulePath} should export at least one HTTP verb (${
                  HTTP_VERBS.join(", ")
                }) or a default export`,
              )
            }
            return Effect.void
          }),
        )
    }
  })
}

export interface GenerateCodeOptions {
  routerModuleId?: string
}

export function generateCode(
  handles: FileRouter.OrderedRouteHandles,
  options: GenerateCodeOptions = {},
): string {
  const {
    routerModuleId = "effect-start",
  } = options
  const definitions: string[] = []
  const pageVariables: string[] = []
  const layoutVariables: string[] = []
  const serverVariables: string[] = []

  let currentLayout: { routePath: string; varName: string } | null = null
  const processedLayouts: { routePath: string; varName: string }[] = []

  for (const handle of handles) {
    const prefix = getHandlePrefix(handle.type)
    const normalizedPath = handle
      .routePath
      // remove leading slash
      .slice(1)
      // convert slashes to double underscores
      .replace(/\//g, "__")
      // convert dots, tildes, and hyphens to underscores
      .replace(/[.~-]/g, "_")
    const varName = `${prefix}__${normalizedPath}`

    // Reset current layout if it's not an ancestor of current route
    if (
      currentLayout
      && !(
        currentLayout.routePath === "/"
        || handle.routePath === currentLayout.routePath
        || (currentLayout.routePath !== "/"
          && handle.routePath.startsWith(currentLayout.routePath + "/"))
      )
    ) {
      // Find the most specific layout that is still a valid parent
      currentLayout = processedLayouts
        .filter(layout =>
          layout.routePath === "/"
          || handle.routePath === layout.routePath
          || handle.routePath.startsWith(layout.routePath + "/")
        )
        .reduce(
          (best, layout) =>
            !best || layout.routePath.length > best.routePath.length
              ? layout
              : best,
          null as { routePath: string; varName: string } | null,
        )
    }

    switch (handle.type) {
      case "LayoutHandle": {
        const parentPart = currentLayout
          ? `\n\tparent: ${currentLayout.varName},`
          : ""
        const code = `const ${varName} = {
\tpath: "${handle.routePath}",${parentPart}
\tload: () => import("./${handle.modulePath}"),
} as const`

        definitions.push(code)
        layoutVariables.push(varName)

        // Set this layout as current and add to processed layouts
        currentLayout = { routePath: handle.routePath, varName }
        processedLayouts.push(currentLayout)

        break
      }
      case "PageHandle": {
        const parentPart = currentLayout
          ? `\n\tparent: ${currentLayout.varName},`
          : ""
        const code = `const ${varName} = {
\tpath: "${handle.routePath}",${parentPart}
\tload: () => import("./${handle.modulePath}"),
} as const`

        definitions.push(code)
        pageVariables.push(varName)

        break
      }
      case "ServerHandle": {
        const code = `const ${varName} = {
\tpath: "${handle.routePath}",
\tload: () => import("./${handle.modulePath}"),
} as const`

        definitions.push(code)
        serverVariables.push(varName)

        break
      }
    }
  }

  const header = `
/** 
 * Auto-generated by effect-start.
 */
`
    .trim()

  return `${header}

import type { Router } from "${routerModuleId}"

${definitions.join("\n\n")}

export const Layouts: Router.LayoutRoutes = ${
    layoutVariables.length === 0 ? "[]" : `[
\t${layoutVariables.join(",\n\t")}
]`
  } as const

export const Pages: Router.PageRoutes = ${
    pageVariables.length === 0 ? "[]" : `[
\t${pageVariables.join(",\n\t")}
]`
  } as const

export const Servers: Router.ServerRoutes = ${
    serverVariables.length === 0 ? "[]" : `[
\t${serverVariables.join(",\n\t")}
]`
  } as const
 `
    .replace(/\t/g, "  ")
}

/**
 * Updates the manifest file only if the generated content differs from the existing file.
 * This prevents infinite loops when watching for file changes.
 */
export function update(
  routesPath: string,
  manifestPath = "_manifest.ts",
  options: GenerateCodeOptions = {},
): Effect.Effect<void, PlatformError, FileSystem.FileSystem> {
  return Effect.gen(function*() {
    manifestPath = NPath.resolve(routesPath, manifestPath)

    const fs = yield* FileSystem.FileSystem
    const files = yield* fs.readDirectory(routesPath, { recursive: true })
    const handles = FileRouter.getRouteHandlesFromPaths(files)

    // Validate server modules
    yield* validateServerModules(routesPath, handles)

    const newCode = generateCode(handles, options)

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
  options: GenerateCodeOptions = {},
): Effect.Effect<void, PlatformError, FileSystem.FileSystem> {
  return Effect.gen(function*() {
    manifestPath = NPath.resolve(routesPath, manifestPath)

    const fs = yield* FileSystem.FileSystem
    const files = yield* fs.readDirectory(routesPath, { recursive: true })
    const handles = FileRouter.getRouteHandlesFromPaths(files)

    // Validate server modules
    yield* validateServerModules(routesPath, handles)

    const code = generateCode(handles, options)

    yield* Effect.logDebug(`Generating file routes manifest: ${manifestPath}`)

    yield* fs.writeFileString(
      manifestPath,
      code,
    )
  })
}
