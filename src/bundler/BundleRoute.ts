import type * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Option from "effect/Option"
import * as Entity from "../Entity.ts"
import * as PathPattern from "../internal/PathPattern.ts"
import * as Route from "../Route.ts"
import * as RouteTree from "../RouteTree.ts"
import * as Values from "../internal/Values.ts"
import * as Bundle from "./Bundle.ts"

/**
 * Creates a GET route that serves bundle artifacts.
 * Mount at a path with a wildcard param (any name works).
 *
 * ```ts
 * RouteTree.make({
 *   "/_bundle/:path+": BundleRoute.make(Bundle.ClientBundle),
 * })
 * ```
 */
export const make = <Tag extends Context.Tag<any, Bundle.BundleContext>>(tag: Tag) =>
  Route.get(
    Route.render(function* (ctx) {
      const bundle = yield* tag
      if (bundle.rebuild) {
        yield* bundle.rebuild()
      }
      const request = yield* Route.Request
      const url = new URL(request.url)
      const mountPath = (ctx as unknown as { path?: string }).path ?? "/"
      const params = PathPattern.match(mountPath, url.pathname)
      const artifactPath = params ? Values.firstValue(params) : undefined
      if (!artifactPath) {
        return Entity.make("Not Found", { status: 404 })
      }
      const blob = bundle.getArtifact(artifactPath)
      if (!blob) {
        return Entity.make("Not Found", { status: 404 })
      }
      const bytes = new Uint8Array(yield* Effect.promise(() => blob.arrayBuffer()))
      return Entity.make(bytes, {
        headers: {
          "content-type": blob.type || "application/octet-stream",
          "cache-control": "public, max-age=31536000, immutable",
        },
      })
    }),
  )

export const client = () => make(Bundle.ClientBundle)

/**
 * Merges a bundle-serving route into the route tree.
 *
 * When called without arguments, checks if `ClientBundle` is available
 * in context and only adds the route if it is. This makes it safe to
 * include unconditionally — it's a no-op when no bundle is provided.
 */
export const layer = (options?: {
  bundle?: Context.Tag<any, Bundle.BundleContext>
  path?: PathPattern.PathPattern
}) => {
  const path = options?.path ?? "/_bundle/:path*"

  if (options?.bundle) {
    return Route.layerMerge({
      [path]: make(options.bundle),
    })
  }

  return Layer.effect(
    Route.Routes,
    Effect.gen(function* () {
      const clientBundle = yield* Effect.serviceOption(Bundle.ClientBundle)
      const existing = yield* Effect.serviceOption(Route.Routes).pipe(
        Effect.andThen(Option.getOrUndefined),
      )
      if (Option.isNone(clientBundle)) {
        return existing ?? RouteTree.make({})
      }
      const bundleTree = RouteTree.make({ [path]: make(Bundle.ClientBundle) })
      return existing ? RouteTree.merge(existing, bundleTree) : bundleTree
    }),
  )
}
