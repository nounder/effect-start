import type { PubSub } from "effect"
import { Context, Data, Effect, pipe } from "effect"
import * as Schema from "effect/Schema"

export const BundleEntrypointMetaKey: unique symbol = Symbol.for(
  "effect-start/BundleEntrypointMetaKey",
)

export type BundleOutputMetaValue = {}

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

export const BundleEvent = Schema.Union(BundleEventChange, BundleEventBuildError)

export type BundleEvent = typeof BundleEvent.Type

const IdPrefix = "effect-start/tags/"

export type BundleKey = `${string}Bundle`

export type BundleId = `${typeof IdPrefix}${BundleKey}`

/**
 * Passed to bundle effects and within bundle runtime.
 * Used to expose artifacts via HTTP server and properly resolve
 * imports within the bundle.
 */
export type BundleContext = BundleManifest & {
  // TODO: consider removing resolve: way of resolving URL should be
  // the same regardless of underlying bundler since we have access
  // to all artifacts already.
  resolve: (url: string) => string | null
  getArtifact: (path: string) => Blob | null
  events?: PubSub.PubSub<BundleEvent>
}

export class BundleError extends Data.TaggedError("BundleError")<{
  message: string
  cause?: unknown
}> {}

export const emptyBundleContext: BundleContext = {
  entrypoints: {},
  artifacts: [],
  resolve: () => null,
  getArtifact: () => null,
}

export const handleBundleErrorSilently = (
  effect: Effect.Effect<BundleContext, BundleError>,
): Effect.Effect<BundleContext, never> =>
  pipe(
    effect,
    Effect.catchTag("BundleError", (error) =>
      Effect.gen(function* () {
        yield* Effect.logError("Bundle build failed", error)
        return emptyBundleContext
      }),
    ),
  )

export const Tag =
  <const T extends BundleKey>(name: T) =>
  <Identifier>() =>
    Context.Tag(`${IdPrefix}${name}` as BundleId)<Identifier, BundleContext>()

export type Tag = Context.Tag<BundleId, BundleContext>

export class ClientBundle extends Tag("ClientBundle")<ClientBundle>() {}
export class ServerBundle extends Tag("ServerBundle")<ServerBundle>() {}
