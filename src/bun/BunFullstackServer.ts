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
    const module = yield* Effect.tryPromise(() => routeModule.load()).pipe(
      Effect.orDie,
    )
    const defaultExport = module.default

    // Check if this is a BunRoute (HTML bundle route)
    if (BunRoute.isBunRoute(defaultExport)) {
      const path = routeModule.path
      // Bun will serve the bundle at {path}.original
      const originalPath = `${path}.original`

      // Load the HTML bundle using the loader function
      const bundleModule = yield* Effect.tryPromise(() =>
        defaultExport.loader()
      ).pipe(
        Effect.orDie,
      )
      const bundle = bundleModule.default

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

      // Pass buildBunRoutes to httpServer.layer() so it can register
      // routes dynamically during server.serve() when Router is available
      return httpServer.layer(
        {
          development,
          ...opts,
        },
        buildBunRoutes,
      )
    }),
  )
}

/**
 * Builds BunRoute routes from Router service.
 * This is called during server.serve() when Router is available.
 */
export const buildBunRoutes = Effect.gen(function*() {
  const routerOption = yield* Effect.serviceOption(Router.Router)

  console.log("Router option:", Option.isSome(routerOption) ? "SOME" : "NONE")

  const bunRoutes: Record<string, any> = {}

  if (Option.isSome(routerOption)) {
    const router = routerOption.value
    console.log("Router modules count:", router.modules.length)

    // Extract BunRoute bundles from all route modules
    for (const routeModule of router.modules) {
      console.log("Processing route module:", routeModule.path)
      const result = yield* processBunRouteModule(routeModule)

      console.log(
        "Result for",
        routeModule.path,
        ":",
        Option.isSome(result) ? "FOUND BunRoute" : "Not a BunRoute",
      )

      if (Option.isSome(result)) {
        const { originalPath, bundle } = result.value
        console.log(`Registering Bun route: ${originalPath}`, bundle)
        bunRoutes[originalPath] = bundle
      }
    }
  }

  console.log("Final bunRoutes:", bunRoutes)
  console.log("BunRoutes keys:", Object.keys(bunRoutes))

  return bunRoutes
})
