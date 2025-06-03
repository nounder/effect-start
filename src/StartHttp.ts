import {
  HttpApp,
  HttpMiddleware,
  HttpServerRequest,
  HttpServerResponse,
} from "@effect/platform"
import { Effect } from "effect"
import {
  Bundle,
  BundleHttp,
} from "."
import { ClientKey } from "./Bundle.ts"

type SsrRenderer = (req: Request) => PromiseLike<Response>

/**
 * Attempts to render SSR page. If the renderer returns 404,
 * we fall back to app.
 */
export function ssr(renderer: SsrRenderer) {
  return Effect.gen(function*() {
    const request = yield* HttpServerRequest.HttpServerRequest
    const webRequest = request.source as Request
    const ssrRes = yield* Effect.tryPromise(() => renderer(webRequest))

    return HttpServerResponse.raw(ssrRes.body, {
      status: ssrRes.status,
      headers: ssrRes.headers,
    })
  })
}

export function withBundleAssets<
  Key extends Bundle.BundleKey = ClientKey,
>(opts?: {
  key?: Key
  path?: string
}) {
  return HttpMiddleware.make(app =>
    Effect.gen(function*() {
      const request = yield* HttpServerRequest.HttpServerRequest
      const bundleResponse = yield* BundleHttp.httpApp(
        Bundle.tagged(opts?.key ?? ClientKey),
      )

      // Fallback to original app
      return yield* app
    })
  )
}
