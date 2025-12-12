/**
 * Bun adapter for enhanced-resolve
 *
 * This module provides a drop-in replacement for `enhanced-resolve` that uses
 * Bun's built-in resolver. It implements the subset of the enhanced-resolve API
 * used for Tailwind CSS.
 */
import fs from "node:fs"
import path from "node:path"

type ErrorWithDetail =
  & Error
  & {
    details?: string
  }

interface ResolveRequest {
  path: string | false
  context?: object
  descriptionFilePath?: string
  descriptionFileRoot?: string
  descriptionFileData?: Record<string, unknown>
  relativePath?: string
  ignoreSymlinks?: boolean
  fullySpecified?: boolean
}

interface ResolveContext {
  contextDependencies?: { add: (item: string) => void }
  fileDependencies?: { add: (item: string) => void }
  missingDependencies?: { add: (item: string) => void }
  stack?: Set<string>
  log?: (str: string) => void
  yield?: (request: ResolveRequest) => void
}

interface ResolveOptions {
  extensions?: string[]
  mainFields?: (string | string[])[]
  conditionNames?: string[]
  fileSystem?: unknown
  useSyncFileSystemCalls?: boolean
  modules?: string | string[]
}

export interface Resolver {
  resolve(
    context: object,
    path: string,
    request: string,
    resolveContext: ResolveContext,
    callback: (
      err: null | ErrorWithDetail,
      res?: string | false,
      req?: ResolveRequest,
    ) => void,
  ): void
}

export class CachedInputFileSystem {
  constructor(
    _fileSystem: unknown,
    _duration: number,
  ) {}
}

export const ResolverFactory = {
  createResolver(options: ResolveOptions): Resolver {
    const extensions = options.extensions ?? []
    const mainFields = (options.mainFields ?? []).flatMap((f) =>
      Array.isArray(f) ? f : [f]
    )
    const conditionNames = options.conditionNames ?? []

    return {
      resolve(
        _context: object,
        basePath: string,
        id: string,
        _resolveContext: ResolveContext,
        callback: (
          err: null | ErrorWithDetail,
          res?: string | false,
          req?: ResolveRequest,
        ) => void,
      ): void {
        try {
          const result = resolveSync(id, basePath, {
            extensions,
            mainFields,
            conditionNames,
          })
          callback(null, result)
        } catch (err) {
          callback(err instanceof Error ? err : new Error(String(err)))
        }
      },
    }
  },
}

interface ResolveInternalOptions {
  extensions: string[]
  mainFields: string[]
  conditionNames: string[]
}

function resolveSync(
  id: string,
  base: string,
  options: ResolveInternalOptions,
): string | undefined {
  if (id.startsWith(".") || id.startsWith("/")) {
    for (const ext of ["", ...options.extensions]) {
      const fullPath = path.resolve(base, id + ext)
      if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
        return fullPath
      }
    }
    return undefined
  }

  const packagePath = resolvePackagePath(id, base)
  if (!packagePath) return undefined

  const packageJsonPath = path.join(packagePath, "package.json")
  if (!fs.existsSync(packageJsonPath)) return undefined

  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"))

  for (const field of options.mainFields) {
    if (typeof packageJson[field] === "string") {
      const resolved = path.resolve(packagePath, packageJson[field])
      if (fs.existsSync(resolved)) return resolved
    }
  }

  if (packageJson.exports) {
    const resolved = resolveExports(
      packageJson.exports,
      packagePath,
      options.conditionNames,
    )
    if (resolved && fs.existsSync(resolved)) return resolved
  }

  try {
    return Bun.resolveSync(id, base)
  } catch {
    return undefined
  }
}

function resolvePackagePath(id: string, base: string): string | undefined {
  const parts = id.split("/")
  const packageName = id.startsWith("@")
    ? parts.slice(0, 2).join("/")
    : parts[0]

  let dir = base
  while (dir !== path.dirname(dir)) {
    const candidate = path.join(dir, "node_modules", packageName)
    if (fs.existsSync(candidate)) return candidate
    dir = path.dirname(dir)
  }
  return undefined
}

function resolveExports(
  exports: unknown,
  packagePath: string,
  conditionNames: string[],
): string | undefined {
  if (typeof exports === "string") {
    return path.resolve(packagePath, exports)
  }

  if (exports && typeof exports === "object" && !Array.isArray(exports)) {
    const exportsObj = exports as Record<string, unknown>

    if ("." in exportsObj) {
      return resolveExports(exportsObj["."], packagePath, conditionNames)
    }

    for (const condition of conditionNames) {
      if (condition in exportsObj) {
        return resolveExports(
          exportsObj[condition],
          packagePath,
          conditionNames,
        )
      }
    }

    if ("default" in exportsObj) {
      return resolveExports(exportsObj["default"], packagePath, conditionNames)
    }
  }

  return undefined
}
