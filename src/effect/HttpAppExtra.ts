import {
  HttpApp,
  HttpRouter,
  HttpServerRequest,
  HttpServerResponse,
} from "@effect/platform"
import { RouteNotFound } from "@effect/platform/HttpServerError"
import { Array, Effect, pipe } from "effect"

/**
 * Sequentially call provided HttpApps until first non-404 response
 * is called.
 */
export const chain = <
  A extends HttpApp.Default<any | RouteNotFound, any>,
  L extends A[],
>(
  apps: L,
): HttpApp.Default<
  L[number] extends HttpApp.Default<infer E, any> ? Exclude<E, RouteNotFound>
    : never,
  L[number] extends HttpApp.Default<any, infer R> ? R : never
> =>
  pipe(
    apps,
    Array.map((app: A) =>
      pipe(
        app,
        Effect.catchTag(
          "RouteNotFound",
          () => HttpServerResponse.empty({ status: 404 }),
        ),
      )
    ),
    apps =>
      Effect.gen(function*() {
        const request = yield* HttpServerRequest.HttpServerRequest

        for (const app of apps) {
          const res = yield* app.pipe()

          if (res.status !== 404) {
            return res
          }
        }

        return yield* Effect.fail(
          new RouteNotFound({
            request,
          }),
        )
      }),
  )
