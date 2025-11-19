// @ts-nocheck
import * as HttpApp from "@effect/platform/HttpApp"
import * as HttpMiddleware from "@effect/platform/HttpMiddleware"
import * as HttpRouter from "@effect/platform/HttpRouter"
import * as HttpServerRequest from "@effect/platform/HttpServerRequest"
import * as Effect from "effect/Effect"
import * as Function from "effect/Function"
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
 * Converts file-based route path format to HttpRouter path format.
 * Examples:
 *   /movies/[id] -> /movies/:id
 *   /docs/[[...slug]] -> /docs/*
 *   /api/[...path] -> /api/*
 */
function convertPathFormat(path: string): string {
  return path
    // Convert required params: [id] -> :id
    .replace(/\[([^\]\.]+)\]/g, ":$1")
    // Convert optional rest params: [[...slug]] -> *
    .replace(/\[\[\.\.\.([^\]]+)\]\]/g, "*")
    // Convert required rest params: [...path] -> *
    .replace(/\[\.\.\.([^\]]+)\]/g, "*")
}

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
      const routeSet = module.default
      const httpRouterPath = convertPathFormat(path)

      for (const route of routeSet.set) {
        router = HttpRouter.route(route.method)(
          httpRouterPath,
          route.handler as any,
        )(
          router,
        )
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
