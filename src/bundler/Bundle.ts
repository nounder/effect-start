import { Context, Data, type Effect, pipe, type PubSub } from "effect"
import * as Schema from "effect/Schema"

/**
 * Generic shape describing a bundle across multiple bundlers
 * (like bun, esbuild & vite)
 */
export const BundleManifestSchema = Schema.Struct({
  entrypoints: Schema.Record({
    key: Schema.String,
    value: Schema.String,
  }),
  artifacts: Schema.Array(
    Schema.Struct({
      path: Schema.String,
      type: Schema.String,
      size: Schema.Number,
      hash: pipe(Schema.String, Schema.optional),
      imports: pipe(
        Schema.Array(
          Schema.Struct({
            path: Schema.String,
            kind: Schema.Literal(
              "import-statement",
              "require-call",
              "require-resolve",
              "dynamic-import",
              "import-rule",
              "url-token",
              "internal",
              "entry-point-run",
              "entry-point-build",
            ),
          }),
        ),
        Schema.optional,
      ),
    }),
  ),
})

export type BundleManifest = typeof BundleManifestSchema.Type

const BundleEventChange = Schema.TaggedStruct("Change", {
  path: Schema.String,
})

const BundleEventBuildError = Schema.TaggedStruct("BuildError", {
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
  manifest: BundleManifest
  resolve: (url: string) => string | undefined
  getArtifact: (path: string) => Blob | undefined
  rebuild?: () => Effect.Effect<BundleContext, BundleError>
  events?: PubSub.PubSub<typeof BundleEvent.Encoded>
}

export class BundleError extends Data.TaggedError("BundleError")<{
  message: string
  cause?: unknown
}> {}

export const emptyBundleContext: BundleContext = {
  manifest: { entrypoints: {}, artifacts: [] },
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
 * Relative paths (starting with `./` or `../`) are normalized first, then
 * matched against entrypoints by visiting them in sequence and comparing
 * path segments from the end, picking the most specific match.
 */
export const makeResolver = (
  entrypoints: Record<string, string>,
): (path: string) => string | undefined => {
  const cache: Record<string, string | undefined> = Object.create(null)

  return (path: string): string | undefined => {
    if (path in cache) return cache[path]

    const exact = entrypoints[path]
    if (exact !== undefined) return (cache[path] = exact)

    const normalized = path.startsWith(".")
      ? path.replace(/^(\.\.?\/)+/, "")
      : path
    const needle = normalized.split("/").filter(Boolean)
    if (needle.length === 0) return (cache[path] = undefined)

    let bestKey: string | undefined
    let bestLength = 0

    for (const key of Object.keys(entrypoints)) {
      const segments = key.split("/").filter(Boolean)
      if (segments.length < needle.length) continue

      const tail = segments.slice(segments.length - needle.length)
      if (
        tail.every((seg, i) => seg === needle[i]) &&
        segments.length > bestLength
      ) {
        bestKey = key
        bestLength = segments.length
      }
    }

    return (cache[path] = bestKey !== undefined
      ? entrypoints[bestKey]
      : undefined)
  }
}
