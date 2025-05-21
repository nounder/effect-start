import {
  Headers,
  type HttpApp,
  HttpServerRequest,
  HttpServerResponse,
} from "@effect/platform"
import { RouteNotFound } from "@effect/platform/HttpServerError"
import { Context, Effect, Scope, Stream } from "effect"
import * as NPath from "node:path"
import * as NUrl from "node:url"
import {
  type BundleContext,
  BundleEntrypointMetaKey,
  type BundleEntrypointMetaValue,
  BundleError,
  type BundleEvent,
  type BundleKey,
  BundleOutputMetaKey,
  type BundleOutputMetaValue,
  ClientKey,
  ServerKey,
  tagged,
} from "./Bundle.ts"
import * as SseHttpResponse from "./SseHttpResponse.ts"

type BundleEntrypointHttpApp<E = never, R = never> =
  & HttpApp.Default<E, R>
  & {
    readonly [BundleEntrypointMetaKey]: BundleEntrypointMetaValue
  }

type BundleOutputHttpApp<E = never, R = never> =
  & HttpApp.Default<E, R>
  & {
    readonly [BundleOutputMetaKey]: BundleOutputMetaValue
  }

export function handleEntrypoint(
  uri?: string,
): BundleEntrypointHttpApp<RouteNotFound, ServerKey>
export function handleEntrypoint<K extends BundleKey>(
  uri: string,
  bundleKey: K,
): BundleEntrypointHttpApp<RouteNotFound, K>
export function handleEntrypoint<
  K extends BundleKey = ServerKey,
>(
  uri?: string,
  bundleKey?: K,
): BundleEntrypointHttpApp<RouteNotFound, K> {
  return Object.assign(
    Effect.gen(function*() {
      uri = uri?.startsWith("file://") ? NUrl.fileURLToPath(uri) : uri

      const request = yield* HttpServerRequest.HttpServerRequest
      const bundle = yield* tagged(bundleKey ?? ClientKey)
      const requestPath = request.url.substring(1)
      const pathAttempts = uri
        ? [
          // expand this array so it includes all potential path
          // by starting with the uri and then popping root directory AI!
        ]
        : [
          `${requestPath}.html`,
          `${requestPath}/index.html`,
          requestPath === "" ? "index.html" : "",
        ]
      console.log(pathAttempts)
      const artifact = pathAttempts
        .map(path => bundle.getArtifact(path))
        .find(Boolean)

      if (artifact) {
        return yield* renderBlob(artifact)
      }

      return yield* Effect.fail(
        new RouteNotFound({
          request,
        }),
      )
    }),
    {
      [BundleEntrypointMetaKey]: {
        uri: uri ?? null,
      },
    },
  )
}

export function httpApp(): BundleOutputHttpApp<never, ServerKey>
export function httpApp<T extends BundleKey>(
  bundleTag: Context.Tag<T, BundleContext>,
): BundleOutputHttpApp<RouteNotFound, T | Scope.Scope>
export function httpApp<T extends BundleKey>(
  bundleTag?: Context.Tag<T, BundleContext>,
): BundleOutputHttpApp<RouteNotFound, T | Scope.Scope> {
  return Object.assign(
    toHttpApp(bundleTag ?? tagged(ClientKey as T)),
    {
      [BundleOutputMetaKey]: {},
    },
  )
}

export const toHttpApp = <T extends BundleKey>(
  bundleTag: Context.Tag<T, BundleContext>,
): Effect.Effect<
  HttpServerResponse.HttpServerResponse,
  RouteNotFound,
  HttpServerRequest.HttpServerRequest | Scope.Scope | T
> =>
  Effect.gen(function*() {
    const request = yield* HttpServerRequest.HttpServerRequest
    const bundle = yield* bundleTag
    const path = request.url.substring(1)

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
      return yield* SseHttpResponse.make<BundleEvent>(
        Stream.fromPubSub(bundle.events),
      )
    }

    const artifact = bundle.artifacts[path]

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

/**
 * Render HTML to a string.
 * Useful for SSR.
 */
export const renderPromise = <I extends BundleKey>(
  clientBundle: Context.Tag<I, BundleContext>,
  render: (
    request: Request,
    resolve: (url: string) => string,
  ) => Promise<Response>,
): HttpApp.Default<BundleError | RouteNotFound, I> => {
  return Effect.gen(function*() {
    const bundle = yield* clientBundle
    const req = yield* HttpServerRequest.HttpServerRequest
    const fetchReq = req.source as Request

    // TODO: add support for file:// urls
    // this will require handling source base path
    const resolve = (url: string): string => {
      const path = url.startsWith("file://")
        ? fileURLToPath(url)
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
        new BundleError({
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

const renderBlob = (blob: Blob) =>
  Effect.gen(function*() {
    const bytes = yield* Effect.promise(() => blob.arrayBuffer())
      .pipe(
        Effect.andThen(v => new Uint8Array(v)),
      )

    return HttpServerResponse.uint8Array(bytes, {
      headers: {
        "Content-Type": blob.type,
        "Content-Length": String(blob.size),
      },
    })
  })
