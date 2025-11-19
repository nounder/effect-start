/**
 * BunFullstackServer integrates Bun's native file routing with Effect's HTTP server.
 *
 * This module extends the standard BunHttpServer to support BunRoute, enabling
 * developers to serve Bun-native HTML bundles alongside Effect-based routes.
 */
import { BunHttpServer } from "@effect/platform-bun"
import * as Config from "effect/Config"
import * as Effect from "effect/Effect"
import * as Fiber from "effect/Fiber"
import * as Layer from "effect/Layer"
import * as Option from "effect/Option"
import * as FileRouter from "../FileRouter.ts"
import * as Router from "../Router.ts"
import * as BunRoute from "./BunRoute.ts"
import * as httpServer from "./BunFullstackServer_httpServer.ts"

// As of Bun v1.2.13, these types are not publicy exported.
type BunServeFuntionOptions = Parameters<
  typeof Bun.serve<any, {}>
>[0]

type DefaultOptions = Parameters<typeof BunHttpServer.make>[0]

type Options =
  & DefaultOptions
  & Omit<BunServeFuntionOptions, "fetch" | "error">

export const make = (opts: Options) => {
  return Effect.gen(function*() {
    const env = yield* Config
      .string("NODE_ENV")
      .pipe(Config.option)

    return httpServer.make({
      development: Option.getOrNull(env) === "development",
      ...opts,
    })
  })
}

/**
 * Processes a route module and extracts BunRoute bundles.
 *
 * If the route module exports a BunRoute, loads its HTML bundle and returns
 * an entry for Bun's native routes option. Otherwise, returns undefined.
 */
const processBunRouteModule = (
  routeModule: FileRouter.RouteModule,
) =>
  Effect.gen(function*() {
    // Load the route module to inspect its default export
    const module = yield* Effect.tryPromise(() => routeModule.load())
    const defaultExport = module.default

    // Check if this is a BunRoute (HTML bundle route)
    if (BunRoute.isBunRoute(defaultExport)) {
      const path = routeModule.path
      // Bun will serve the bundle at {path}.original
      const originalPath = `${path}.original`

      // Load the HTML bundle
      const bundle = yield* Effect.tryPromise(() => defaultExport.load())

      return Option.some({ originalPath, bundle })
    }

    return Option.none()
  })

/**
 * Creates a Layer that provides the BunFullstackServer.
 *
 * Scans the router for BunRoute instances and registers them with Bun's
 * native routes option, enabling Bun to serve HTML bundles directly.
 */
export const layer = (opts: Options) => {
  return Layer.unwrapEffect(
    Effect.gen(function*() {
      const env = yield* Config.string("NODE_ENV").pipe(Config.option)
      const development = Option.getOrNull(env) !== "development"

      // Try to get the router service if available
      const routerOption = yield* Effect.serviceOption(Router.Router)

      let bunRoutes: Record<string, any> = {}

      if (Option.isSome(routerOption)) {
        const router = routerOption.value

        // Extract BunRoute bundles from all route modules
        for (const routeModule of router.modules) {
          const result = yield* processBunRouteModule(routeModule)

          if (Option.isSome(result)) {
            const { originalPath, bundle } = result.value
            bunRoutes[originalPath] = bundle
          }
        }
      }

      return httpServer.layer({
        development,
        ...opts,
        // @ts-expect-error - routes is supported by Bun but not in current types
        routes: {
          ...(opts.routes ?? {}),
          ...bunRoutes,
        },
      })
    }),
  )
}
