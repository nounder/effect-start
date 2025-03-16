import {
  HttpApp,
  HttpRouter,
  HttpServerRequest,
  HttpServerResponse,
} from "@effect/platform"
import { RouteNotFound } from "@effect/platform/HttpServerError"
import { Array, Effect, pipe } from "effect"

/**
 * Takes HttpRouter instances and combines them into a single HttpApp.
 *
 * Probably not necessary if you use HttpRouter.mount
 */
export const chain = (...apps: HttpApp.Default[]): HttpApp.Default =>
  pipe(
    apps,
    Array.map((app) =>
      pipe(
        app,
        Effect.andThen((res) =>
          res.status === 404
            ? Effect.andThen(HttpServerRequest.HttpServerRequest, (request) =>
              Effect.fail(new RouteNotFound({ request })))
            : res
        ),
      )
    ),
    Effect.firstSuccessOf,
    Effect.catchTag("RouteNotFound", (e) =>
      HttpServerResponse.empty({ status: 404 })),
  )
