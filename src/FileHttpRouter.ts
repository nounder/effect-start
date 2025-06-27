import * as HttpApp from "@effect/platform/HttpApp"
import * as HttpRouter from "@effect/platform/HttpRouter"
import { RouteNotFound } from "@effect/platform/HttpServerError"
import * as HttpServerRequest from "@effect/platform/HttpServerRequest"
import * as Effect from "effect/Effect"
import * as Router from "./Router.ts"

/**
 * Combines Effect error channel from a record of effects.
 */
type RecordEffectError<A> = A extends Record<string, any> ? Exclude<
    {
      [K in keyof A]: A[K] extends Effect.Effect<any, infer E, any> ? E
        : never
    }[keyof A],
    undefined
  >
  : never

/**
 * Combines Effect requirement channel from a record of effects.
 */
type RecordEffectRequirements<A> = A extends Record<string, any> ? Exclude<
    {
      [K in keyof A]: A[K] extends Effect.Effect<any, any, infer R> ? R
        : never
    }[keyof A],
    undefined
  >
  : never

/**
 * Infers the HttpRouter type from an array of ServerRoutes
 */
export type HttpRouterFromServerRoutes<
  Routes extends ReadonlyArray<Router.ServerRoute>,
> = HttpRouter.HttpRouter<
  (Routes extends ReadonlyArray<infer Route>
    ? Route extends Router.ServerRoute
      ? RecordEffectError<Awaited<ReturnType<Route["load"]>>>
    : never
    : never),
  Exclude<
    Routes extends ReadonlyArray<infer Route>
      ? Route extends Router.ServerRoute
        ? RecordEffectRequirements<Awaited<ReturnType<Route["load"]>>>
      : never
      : never,
    // exclude HttpServerRequest since HttpRouter already has it
    HttpServerRequest.HttpServerRequest
  >
>

/**
 * Makes a HttpRouter from file-based routes.
 */
export function make<Routes extends Router.ServerRoutes>(
  routes: Routes,
): Effect.Effect<HttpRouterFromServerRoutes<Routes>, unknown> {
  return Effect.gen(function*() {
    const modules = yield* Effect.forEach(
      routes,
      (route) =>
        Effect.tryPromise(() => route.load()).pipe(
          Effect.map((module) => ({ path: route.path, module })),
        ),
    )

    let router: HttpRouter.HttpRouter<any, any> = HttpRouter.empty

    for (const { path, module } of modules) {
      const addRoute = (
        method: "*" | Router.ServerMethod,
        handler: Router.ServerHandle,
      ) => {
        router = HttpRouter.route(method)(router, path, handler)
      }

      Router.ServerMethods.forEach((method) => {
        if (module[method]) {
          addRoute(method, module[method])
        }
      })

      if (module.default) {
        addRoute("*", module.default)
      }
    }

    return router as HttpRouterFromServerRoutes<Routes>
  })
}
