import { HttpApp } from "@effect/platform"
import * as HttpMiddleware from "@effect/platform/HttpMiddleware"
import * as HttpRouter from "@effect/platform/HttpRouter"
import * as HttpServerRequest from "@effect/platform/HttpServerRequest"
import * as Array from "effect/Array"
import * as Effect from "effect/Effect"
import * as Function from "effect/Function"
import * as Route from "./Route.ts"
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
): Effect.Effect<HttpRouterFromServerRoutes<Routes>> {
  return Effect.gen(function*() {
    const modules = yield* Effect.forEach(
      routes,
      (route) =>
        Function.pipe(
          Effect.tryPromise(() => route.load()),
          Effect.orDie,
          Effect.map((module) => ({ path: route.path, module })),
        ),
    )

    let router: HttpRouter.HttpRouter<any, any> = HttpRouter.empty

    for (const { path, module } of modules) {
      const addRoute = (
        method: "*" | Router.ServerMethod,
        handler: HttpApp.Default<any, any>,
      ) => {
        router = HttpRouter.route(method)(path, handler)(router)
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

export function middleware() {
  return HttpMiddleware.make((app) =>
    Effect.gen(function*() {
      const routerContext = yield* Router.Router
      const router = routerContext.httpRouter
      const res = yield* router.pipe(
        Effect.catchTag("RouteNotFound", () => app),
      )

      return res
    })
  )
}
