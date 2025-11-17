import {
  Context,
  Data,
  Effect,
  pipe,
  PubSub,
  Schema as S,
} from "effect"
import { importBlob } from "./JsModule.ts"

export const BundleEntrypointMetaKey: unique symbol = Symbol.for(
  "effect-start/BundleEntrypointMetaKey",
)

export type BundleOutputMetaValue = {}

/**
 * Generic shape describing a bundle across multiple bundlers
 * (like bun, esbuild & vite)
 */
export const BundleManifestSchema = S.Struct({
  entrypoints: S.Record({
    key: S.String,
    value: S.String,
  }),
  artifacts: S.Array(
    S.Struct({
      path: S.String,
      type: S.String,
      size: S.Number,
      hash: pipe(
        S.String,
        S.optional,
      ),
      imports: pipe(
        S.Array(
          S.Struct({
            path: S.String,
            kind: S.Literal(
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
        S.optional,
      ),
    }),
  ),
})

export type BundleManifest = typeof BundleManifestSchema.Type

export type BundleEvent =
  | {
    type: "Change"
    path: string
  }
  | {
    type: "BuildError"
    error: string
  }

const IdPrefix = "effect-start/tags/"

export type BundleKey = `${string}Bundle`

export type BundleId = `${typeof IdPrefix}${BundleKey}`

/**
 * Passed to bundle effects and within bundle runtime.
 * Used to expose artifacts via HTTP server and properly resolve
 * imports within the bundle.
 */
export type BundleContext =
  & BundleManifest
  & {
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

export const Tag = <const T extends BundleKey>(name: T) => <Identifier>() =>
  Context.Tag(`${IdPrefix}${name}` as BundleId)<
    Identifier,
    BundleContext
  >()

export type Tag = Context.Tag<
  BundleId,
  BundleContext
>

export class ClientBundle extends Tag("ClientBundle")<ClientBundle>() {}
export class ServerBundle extends Tag("ServerBundle")<ServerBundle>() {}

/**
 * Lodas a bundle as a javascript module.
 * Bundle must have only one entrypoint.
 */
export function load<M>(
  bundle: Effect.Effect<BundleContext, BundleError>,
): Effect.Effect<M, BundleError> {
  return Effect.gen(function*() {
    const context = yield* bundle
    const [artifact, ...rest] = Object.values(context.entrypoints)

    if (rest.length > 0) {
      return yield* Effect.fail(
        new BundleError({
          message: "Multiple entrypoints are not supported in load()",
        }),
      )
    }

    return yield* Effect.tryPromise({
      try: () => {
        const blob = context.getArtifact(artifact)

        return importBlob<M>(blob!)
      },
      catch: (e) =>
        new BundleError({
          message: "Failed to load entrypoint",
          cause: e,
        }),
    })
  })
}
