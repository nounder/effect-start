import * as Headers from "@effect/platform/Headers"
import type * as HttpApp from "@effect/platform/HttpApp"
import * as HttpMiddleware from "@effect/platform/HttpMiddleware"
import { RouteNotFound } from "@effect/platform/HttpServerError"
import * as HttpServerRequest from "@effect/platform/HttpServerRequest"
import * as HttpServerResponse from "@effect/platform/HttpServerResponse"
import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Function from "effect/Function"
import * as Option from "effect/Option"
import * as Scope from "effect/Scope"
import * as Stream from "effect/Stream"
import * as NPath from "node:path"
import * as NUrl from "node:url"
import * as Bundle from "./Bundle.ts"
import * as SseHttpResponse from "./SseHttpResponse.ts"

const DefaultBundleEndpoint = "/_bundle"

/**
 * Handles all entrypoints automatically.
 * Serves HTML entrypoints without requiring explicit route definitions for each one.
 * Examples:
 *  index.html -> /
 *  contact.html -> /contact
 *  about/index.html -> /about
 */
export function entrypoint(
  uri?: string,
): HttpApp.Default<RouteNotFound, Bundle.ClientBundle> {
  return Effect.gen(function*() {
    uri = uri?.startsWith("file://") ? NUrl.fileURLToPath(uri) : uri
    const request = yield* HttpServerRequest.HttpServerRequest
    const bundle = yield* Bundle.ClientBundle
    const requestPath = request.url.substring(1)
    const pathAttempts = uri
      ? [
        // try paths from all parent directories in case absolute path is passed,
        // like it is the case for `import(f, { type: "file" })`
        ...uri
          .split(NPath.sep)
          .map((_, i, a) => NPath.join(...a.slice(i))),
      ]
      : [
        requestPath ? `${requestPath}.html` : null,
        requestPath ? `${requestPath}/index.html` : null,
        requestPath === "" ? "index.html" : "",
      ]
    const artifact = pathAttempts
      .filter(Boolean)
      .map(path => bundle.getArtifact(path as string))
      .find(Boolean)

    if (artifact) {
      return yield* renderBlob(artifact)
    }

    return yield* Effect.fail(
      new RouteNotFound({
        request,
      }),
    )
  })
}

export function httpApp(
  opts?: { urlPrefix?: string },
): HttpApp.Default<
  RouteNotFound,
  Scope.Scope | Bundle.ClientBundle
> {
  return toHttpApp(Bundle.ClientBundle, opts)
}

export const toHttpApp = <E, R>(
  bundleTag: Effect.Effect<Bundle.BundleContext, E, R>,
  opts?: { urlPrefix?: string },
): Effect.Effect<
  HttpServerResponse.HttpServerResponse,
  RouteNotFound | E,
  HttpServerRequest.HttpServerRequest | R
> => {
  return Effect.gen(function*() {
    const request = yield* HttpServerRequest.HttpServerRequest
    const bundle = yield* bundleTag
    const path = opts?.urlPrefix && request.url.startsWith(opts.urlPrefix + "/")
      ? request.url.substring(opts.urlPrefix.length + 1)
      : request.url.substring(1)

    /**
     * Expose manifest that contains information about the bundle.
     */
    if (path === "manifest.json") {
      return HttpServerResponse.text(
        JSON.stringify(
          {
            entrypoints: bundle.entrypoints,
            artifacts: bundle.artifacts,
          },
          undefined,
          2,
        ),
        {
          headers: {
            "Content-Type": "application/json",
          },
        },
      )
    }

    /**
     * Expose events endpoint if available.
     * Useful for development to implement live reload.
     */
    if (bundle.events && path === "events") {
      return yield* SseHttpResponse.make<Bundle.BundleEvent>(
        Stream.fromPubSub(bundle.events),
      )
    }

    const artifact = bundle.artifacts.find((a) => a.path === path)

    /**
     * Expose artifacts.
     */
    if (artifact) {
      const artifactBlob = bundle.getArtifact(path)!

      return yield* renderBlob(artifactBlob)
    }

    return yield* Effect.fail(
      new RouteNotFound({
        request,
      }),
    )
  })
}

/**
 * Render HTML to a string.
 * Useful for SSR.
 */
export function renderPromise(
  clientBundle: Bundle.Tag,
  render: (
    request: Request,
    resolve: (url: string) => string,
  ) => Promise<Response>,
) {
  return Effect.gen(function*() {
    const bundle = yield* clientBundle
    const req = yield* HttpServerRequest.HttpServerRequest
    const fetchReq = req.source as Request

    // TODO: add support for file:// urls
    // this will require handling source base path
    const resolve = (url: string): string => {
      const path = url.startsWith("file://")
        ? NUrl.fileURLToPath(url)
        : url
      const publicBase = "/.bundle"
      const publicPath = bundle.resolve(path)

      return NPath.join(publicBase, publicPath ?? path)
    }

    const output = yield* Effect.tryPromise({
      try: () =>
        render(
          fetchReq,
          resolve,
        ),
      catch: (e) =>
        new Bundle.BundleError({
          message: "Failed to render",
          cause: e,
        }),
    })

    return yield* HttpServerResponse.raw(output.body, {
      status: output.status,
      statusText: output.statusText,
      headers: Headers.fromInput(output.headers as any),
    })
  })
}

const renderBlob = (blob: Blob) => {
  return Effect.gen(function*() {
    const bytes = yield* Effect
      .promise(() => blob.arrayBuffer())
      .pipe(
        Effect.andThen(v => new Uint8Array(v)),
      )

    return HttpServerResponse.uint8Array(bytes, {
      headers: {
        "content-type": blob.type,
        "content-length": String(blob.size),
        "cache-control": "public, max-age=3600",
      },
    })
  })
}

/**
 * Exposes bundle assets via HTTP routes.
 * Serves bundle artifacts, manifest.json, and events endpoint at the specified path.
 */
export function withAssets(
  opts?: { path?: string },
) {
  const path = opts?.path ?? DefaultBundleEndpoint

  return HttpMiddleware.make((app) =>
    Effect.gen(function*() {
      const request = yield* HttpServerRequest.HttpServerRequest

      if (request.url.startsWith(path + "/")) {
        return yield* toHttpApp(Bundle.ClientBundle, { urlPrefix: path })
      }

      return yield* app
    })
  )
}

/**
 * @see {entrypoint}
 */
export function withEntrypoints() {
  return HttpMiddleware.make((app) =>
    Effect.gen(function*() {
      const entrypointResponse = yield* entrypoint().pipe(
        Effect.option,
      )

      if (Option.isSome(entrypointResponse)) {
        return entrypointResponse.value
      }

      return yield* app
    })
  )
}

/**
 * Combines both withAssets and withEntrypoints.
 * Provides complete bundle HTTP functionality in a single function call.
 */
export function withBundle(
  opts?: { path?: string },
) {
  return Function.flow(
    withAssets(opts),
    withEntrypoints(),
  )
}
