import { FileSystem } from "@effect/platform"
import {
  Array,
  Context,
  Data,
  Effect,
  Iterable,
  pipe,
  PubSub,
  Record,
  Schema as S,
} from "effect"
import { importBlob } from "./JsModule.ts"

export const BundleEntrypointMetaKey: unique symbol = Symbol.for(
  "effect-bundler/BundleEntrypointMetaKey",
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
  artifacts: S.Record({
    key: S.String,
    value: S.Struct({
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
  }),
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

export type BundleKey = `${string}Bundle`

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
    resolve: (url: string) => string
    getArtifact: (path: string) => Blob | null
    events?: PubSub.PubSub<BundleEvent>
  }

export class BundleError extends Data.TaggedError("BundleError")<{
  message: string
  cause?: unknown
}> {}

/**
 * Creates a tag that symbolicly identifies a bundle.
 *
 * Useful when you want to provide a bundle at the start of the script.
 */
export const Tag = <T extends string>(name: T) => <Identifier>() =>
  Context.Tag(
    `effect-bundler/tags/${name}`,
  )<Identifier, BundleContext>()

export const tagged = <I extends BundleKey>(
  key: I,
) => {
  return Context.GenericTag<I, BundleContext>(key)
}

export const ClientKey = "ClientBundle" as const
export type ClientKey = typeof ClientKey

export const ServerKey = "ServerBundle" as const
export type ServerKey = typeof ServerKey

/**
 * Lodas a bundle as a javascript module.
 * Bundle must have only one entrypoint.
 */
export function load<M>(
  contextEffect: Effect.Effect<BundleContext, BundleError>,
): Effect.Effect<M, BundleError> {
  return Effect.gen(function*() {
    const context = yield* contextEffect
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
