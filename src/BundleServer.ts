import {
  Headers,
  type HttpApp,
  HttpServerRequest,
  HttpServerResponse,
} from "@effect/platform"
import type { RouteNotFound } from "@effect/platform/HttpServerError"
import { fileURLToPath } from "bun"
import { Context, Data, Effect } from "effect"
import * as NPath from "node:path"
import type { BundleContext } from "./Bundle.ts"

class SsrError extends Data.TaggedError("SsrError")<{
  message: string
  cause: unknown
}> {}

export const renderPromise = <I extends `${string}Bundle`>(
  clientBundle: Context.Tag<I, BundleContext>,
  render: (
    request: Request,
    resolve: (url: string) => string,
  ) => Promise<Response>,
): HttpApp.Default<SsrError | RouteNotFound, I> => {
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
        new SsrError({
          message: "Failed to render server-side",
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
