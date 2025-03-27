import { HttpRouter, HttpServerResponse } from "@effect/platform"
import { Context, Data, Effect, Record } from "effect"
import { importJsBlob } from "./esm.ts"

export class BundleError extends Data.TaggedError("BundleError")<{
  cause: unknown
}> {}

export type BundleManifest = {
  entrypoints: {
    [path: string]: string
  }
  artifacts: {
    [path: string]: {
      type: string
      size: number
      hash: string | null
      imports?: Array<any>
    }
  }
}

export type BundleContext =
  & BundleManifest
  & {
    resolve: (url: string) => string
    getBlob: (path: string) => Blob | null
  }

export const Tag = <T extends string>(name: T) => <Identifier>() =>
  Context.Tag(
    `effect-bundler/Bundle/tags/${name}`,
  )<Identifier, BundleContext>()

export const load = <M>(
  context: BundleContext,
): Effect.Effect<M, BundleError> => {
  const [entrypoint] = Object.keys(context.entrypoints)

  return Effect.tryPromise({
    try: () => {
      const blob = context.getBlob(entrypoint)

      return importJsBlob<M>(blob!)
    },
    catch: (e) =>
      new BundleError({
        cause: e,
      }),
  })
}

export const http = <T>(
  bundle: Context.Tag<T, BundleContext>,
) => {
  return Effect.map(
    bundle,
    v =>
      Record.reduce(
        v.artifacts,
        HttpRouter.empty,
        (router, artifact, path) =>
          router.pipe(
            HttpRouter.get(
              `/${path}`,
              HttpServerResponse.text("yo"),
            ),
          ),
      ),
  )
}
