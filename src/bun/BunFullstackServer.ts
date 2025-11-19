import { BunHttpServer } from "@effect/platform-bun"
import * as Config from "effect/Config"
import * as Effect from "effect/Effect"
import * as Fiber from "effect/Fiber"
import * as Layer from "effect/Layer"
import * as Option from "effect/Option"
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

export const layer = (opts: Options) => {
  return Layer.unwrapEffect(
    Effect.gen(function*() {
      const env = yield* Config.string("NODE_ENV").pipe(Config.option)
      const development = Option.getOrNull(env) !== "development"

      const routerOption = yield* Effect.serviceOption(Router.Router)

      let bunRoutes: Record<string, any> = {}

      if (Option.isSome(routerOption)) {
        const router = routerOption.value

        for (const routeModule of router.modules) {
          const module = yield* Effect.tryPromise(() => routeModule.load())
          const defaultExport = module.default

          if (BunRoute.isBunRoute(defaultExport)) {
            const path = routeModule.path
            const originalPath = `${path}.original`

            const bundle = yield* Effect.tryPromise(() => defaultExport.load())
            bunRoutes[originalPath] = bundle
          }
        }
      }

      return httpServer.layer({
        development,
        ...opts,
        routes: {
          ...(opts.routes ?? {}),
          ...bunRoutes,
        },
      })
    }),
  )
}
