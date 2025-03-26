import { HttpRouter, HttpServerResponse } from "@effect/platform"
import { Array, Context, Effect } from "effect"

export type BundleManifest = {
  entrypoints: Record<string, string>
  artifacts: Array<{
    path: string
    hash: string | null
    size: number
    type: string
    imports?: Array<any>
  }>
}

export type BundleContext =
  & BundleManifest
  & {
    resolve: (url: string) => string
    blob: (path: string) => Blob | null
  }

export const Tag = (name: string) => <Identifier>() =>
  Context.Tag(
    `effect-bundler/Bundle/tags/${name}`,
  )<Identifier, BundleContext>()

export const http = <T>(
  bundle: Context.Tag<T, BundleContext>,
) => {
  return Effect.andThen(
    bundle,
    v =>
      Array.reduce(
        v.artifacts,
        HttpRouter.empty,
        (router, artifact) =>
          router.pipe(
            HttpRouter.get(
              `/${artifact.path}`,
              HttpServerResponse.text("yo"),
            ),
          ),
      ),
  )
}
