import * as Effect from "effect/Effect"
import * as NFs from "node:fs"
import * as NPath from "node:path"
import * as NUrl from "node:url"
import * as Mime from "../../internal/Mime.ts"
import * as Bundle from "../Bundle.ts"

export type EntrypointPair = {
  original: string
  resolved: string
  id: string
}

export const toPath = (path: string) => path.startsWith("file://") ? NUrl.fileURLToPath(path) : path

export const toOutputPath = (path: string) => {
  const withoutDot = path.startsWith("./") ? path.slice(2) : path
  return withoutDot.startsWith("/") ? withoutDot.slice(1) : withoutDot
}

export const normalizeEntrypointPath = (path: string): string => {
  const resolved = NPath.resolve(toPath(path))
  try {
    return NFs.realpathSync.native(resolved)
  } catch {
    return resolved
  }
}

export const resolveEntrypointsPaired = (
  entrypoints: Array<string>,
): Array<EntrypointPair> =>
  entrypoints.map((original) => {
    let resolved: string
    try {
      resolved = Bun.resolveSync(toPath(original), process.cwd())
    } catch {
      resolved = toPath(original)
    }
    return { original, resolved, id: normalizeEntrypointPath(resolved) }
  })

export const entrypointKey = (
  original: string,
  resolved: string,
  baseDir: string,
): string => {
  const originalPath = toPath(original)
  if (!NPath.isAbsolute(originalPath)) return originalPath
  const prefix = baseDir ? baseDir + "/" : ""
  return resolved.startsWith(prefix) ? resolved.slice(prefix.length) : resolved
}

export function getBaseDir(paths: Array<string>) {
  if (paths.length === 0) return ""
  if (paths.length === 1) return NPath.dirname(paths[0])

  const segmentsList = paths.map((path) => NPath.dirname(path).split("/").filter(Boolean))

  return (
    segmentsList[0]
      .filter((segment, i) => segmentsList.every((segs) => segs[i] === segment))
      .reduce((path, seg) => `${path}/${seg}`, "") ?? ""
  )
}

export const artifactContentType = (path: string): string => Mime.fromPath(path)

export const finishEntrypointMap = (
  paired: Array<EntrypointPair>,
  artifactPathByEntrypoint: Map<string, string>,
): Effect.Effect<Record<string, string>, Bundle.BundleError> =>
  Effect.gen(function*() {
    const missing = paired.filter((entrypoint) => !artifactPathByEntrypoint.has(entrypoint.id))
    if (missing.length > 0) {
      return yield* Effect.fail(
        new Bundle.BundleError({
          message: `No artifact emitted for ${missing.length} entrypoint(s): ${
            missing.map((p) => p.original).join(", ")
          }`,
        }),
      )
    }

    const baseDir = getBaseDir(paired.map((p) => p.id))
    return Object.fromEntries(
      paired.map((p) => [
        entrypointKey(p.original, p.id, baseDir),
        artifactPathByEntrypoint.get(p.id)!,
      ]),
    )
  })

export const recordEntrypointArtifact = (
  artifactPathByEntrypoint: Map<string, string>,
  entrypointIds: Set<string>,
  entryPointSource: string,
  artifactPath: string,
): Effect.Effect<void, Bundle.BundleError> =>
  Effect.gen(function*() {
    const id = normalizeEntrypointPath(entryPointSource)
    if (!entrypointIds.has(id)) return

    const existing = artifactPathByEntrypoint.get(id)
    if (existing) {
      return yield* Effect.fail(
        new Bundle.BundleError({
          message: `Entrypoint ${entryPointSource} matched multiple artifacts: ${[existing, artifactPath].join(", ")}`,
        }),
      )
    }
    artifactPathByEntrypoint.set(id, artifactPath)
  })
