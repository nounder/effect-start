import * as Context from "effect/Context"
import * as Data from "effect/Data"
import type * as Effect from "effect/Effect"
import type * as PubSub from "effect/PubSub"
import * as Schema from "effect/Schema"

const BundleEventChange = Schema.TaggedStruct("BundleEventChange", {
  path: Schema.String,
})

const BundleEventBuildError = Schema.TaggedStruct("BundleEventBuildError", {
  error: Schema.String,
})

const BundleEvent = Schema.Union(BundleEventChange, BundleEventBuildError)

const IdPrefix = "effect-start/tags/"

export type BundleKey = `${string}Bundle`

export type BundleId = `${typeof IdPrefix}${BundleKey}`

/**
 * Passed to bundle effects and within bundle runtime.
 * Used to expose artifacts via HTTP server and properly resolve
 * imports within the bundle.
 */
export type BundleContext = {
  resolve: (url: string, parent?: string) => string | undefined
  getArtifact: (path: string) => Blob | undefined
  rebuild?: () => Effect.Effect<BundleContext, BundleError>
  events?: PubSub.PubSub<typeof BundleEvent.Encoded>
}

export class BundleError extends Data.TaggedError("BundleError")<{
  message: string
  cause?: unknown
}> {}

export const emptyBundleContext: BundleContext = {
  resolve: () => undefined,
  getArtifact: () => undefined,
}

export const Tag = <const T extends BundleKey>(name: T) => <Identifier>() =>
  Context.Tag(`${IdPrefix}${name}` as `${typeof IdPrefix}${T}`)<
    Identifier,
    BundleContext
  >()

export type Tag<T extends BundleKey = BundleKey> = Context.Tag<
  `${typeof IdPrefix}${T}`,
  BundleContext
>

export class Bundle extends Tag("Bundle")<Bundle>() {}

/**
 * Resolver for a bundle's entrypoints map.
 *
 * Module identifiers (e.g. `"effect-start/datastar"`) are matched exactly.
 *
 * When `parent` is provided, the path is resolved against the parent's directory.
 *
 * Returns `undefined` when no path matches, or when two or more
 * entrypoints tie at the most-specific match length (ambiguous). To
 * disambiguate basename collisions across directories, pass `parent`.
 */
export const makeResolver = (
  entrypoints: Record<string, string>,
): (path: string, parent?: string) => string | undefined => {
  const cache: Record<string, string | undefined> = Object.create(null)

  const stripFileUrl = (s: string): string => {
    const noQuery = s.split("?")[0]!.split("#")[0]!
    return noQuery.startsWith("file://")
      ? noQuery.slice("file://".length)
      : noQuery
  }

  const toSegments = (s: string): Array<string> =>
    stripFileUrl(s).split("/").filter((seg) => seg.length > 0 && seg !== ".")

  const joinAgainstParent = (parent: string, rel: string): Array<string> => {
    const parentSegs = toSegments(parent)
    parentSegs.pop()
    const relSegs = rel.split("/")
    for (const seg of relSegs) {
      if (seg === "" || seg === ".") continue
      if (seg === "..") parentSegs.pop()
      else parentSegs.push(seg)
    }
    return parentSegs
  }

  return (path: string, parent?: string): string | undefined => {
    const cacheKey = parent !== undefined ? `${parent} ${path}` : path
    if (cacheKey in cache) return cache[cacheKey]

    const exact = entrypoints[path]
    if (exact !== undefined) return (cache[cacheKey] = exact)

    const isRelative = path.startsWith("./") || path.startsWith("../")
    const useParent = isRelative && parent !== undefined
    const needle = useParent
      ? joinAgainstParent(parent, path)
      : toSegments(isRelative ? path.replace(/^(\.\.?\/)+/, "") : path)

    if (needle.length === 0) return (cache[cacheKey] = undefined)

    let bestKey: string | undefined
    let bestLength = 0
    let ambiguous = false

    for (const key of Object.keys(entrypoints)) {
      const segments = toSegments(key)
      if (segments.length === 0) continue

      let matches: boolean
      if (useParent) {
        // entrypoint key must be a suffix of the resolved needle
        if (segments.length > needle.length) continue
        const start = needle.length - segments.length
        matches = true
        for (let i = 0; i < segments.length; i++) {
          if (segments[i] !== needle[start + i]) {
            matches = false
            break
          }
        }
      } else {
        // needle (basename-ish) must be a suffix of the entrypoint key
        if (segments.length < needle.length) continue
        const start = segments.length - needle.length
        matches = true
        for (let i = 0; i < needle.length; i++) {
          if (segments[start + i] !== needle[i]) {
            matches = false
            break
          }
        }
      }
      if (!matches) continue

      if (segments.length > bestLength) {
        bestKey = key
        bestLength = segments.length
        ambiguous = false
      } else if (segments.length === bestLength) {
        ambiguous = true
      }
    }

    return (cache[cacheKey] = bestKey !== undefined && !ambiguous
      ? entrypoints[bestKey]
      : undefined)
  }
}
