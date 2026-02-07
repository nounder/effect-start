import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Option from "effect/Option"
import * as Entity from "../Entity.ts"
import * as PathPattern from "../PathPattern.ts"
import * as Route from "../Route.ts"
import * as RouteTree from "../RouteTree.ts"
import * as Values from "../Values.ts"
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
      const url = new URL(ctx.request.url)
      const mountPath = (ctx as unknown as { path?: string }).path ?? "/"
      const params = PathPattern.match(mountPath, url.pathname)
      const artifactPath = params ? Values.firstValue(params) : undefined
      if (!artifactPath) {
        return Entity.make(new Uint8Array(0), { status: 404 })
      }
      const blob = bundle.getArtifact(artifactPath)
      if (!blob) {
        return Entity.make(new Uint8Array(0), { status: 404 })
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

export const layer = (options?: {
  bundle?: Context.Tag<any, Bundle.BundleContext>
  path?: PathPattern.PathPattern
}) =>
  Layer.effect(
    Route.Routes,
    Effect.gen(function* () {
      const existing = yield* Effect.serviceOption(Route.Routes).pipe(
        Effect.andThen(Option.getOrUndefined),
      )
      const path = options?.path ?? "/_bundle/:path+"
      const bundleTree = Route.tree({
        [path]: make(options?.bundle ?? Bundle.ClientBundle),
      })
      if (!existing) return bundleTree
      return RouteTree.merge(existing, bundleTree)
    }),
  )
