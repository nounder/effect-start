import * as FetchHttpClient from "@effect/platform/FetchHttpClient"
import * as FileSystem from "@effect/platform/FileSystem"
import * as HttpClient from "@effect/platform/HttpClient"
import * as HttpRouter from "@effect/platform/HttpRouter"
import * as HttpServer from "@effect/platform/HttpServer"
import * as Effect from "effect/Effect"
import * as Function from "effect/Function"
import * as Layer from "effect/Layer"
import * as Option from "effect/Option"
import * as BunBundle from "./bun/BunBundle.ts"
import * as BunHttpServer from "./bun/BunHttpServer.ts"
import * as BunRoute from "./bun/BunRoute.ts"
import * as BunRuntime from "./bun/BunRuntime.ts"
import * as Bundle from "./Bundle.ts"
import * as BundleHttp from "./BundleHttp.ts"
import * as HttpAppExtra from "./HttpAppExtra.ts"
import * as NodeFileSystem from "./NodeFileSystem.ts"
import * as Router from "./Router.ts"
import * as StartApp from "./StartApp.ts"

export function bundleClient(config: BunBundle.BuildOptions | string) {
  const clientLayer = Layer.effect(
    Bundle.ClientBundle,
    Function.pipe(
      BunBundle.buildClient(config),
      Bundle.handleBundleErrorSilently,
    ),
  )
  const assetsLayer = Layer.effectDiscard(Effect.gen(function*() {
    const router = yield* HttpRouter.Default
    const app = BundleHttp.toHttpApp(Bundle.ClientBundle)

    yield* router.mountApp(
      "/_bundle",
      // we need to use as any here because HttpRouter.Default
      // only accepts default services.
      app as any,
    )
  }))

  return Layer.mergeAll(
    clientLayer,
    assetsLayer,
  )
}

export function layer<
  Layers extends [
    Layer.Layer<never, any, any>,
    ...Array<Layer.Layer<never, any, any>>,
  ],
>(...layers: Layers): Layer.Layer<
  { [k in keyof Layers]: Layer.Layer.Success<Layers[k]> }[number],
  { [k in keyof Layers]: Layer.Layer.Error<Layers[k]> }[number],
  { [k in keyof Layers]: Layer.Layer.Context<Layers[k]> }[number]
> {
  return Layer.mergeAll(...layers)
}

export function serve<ROut, E>(
  load: () => Promise<{
    default: Layer.Layer<
      ROut,
      E,
      | HttpServer.HttpServer
      | HttpClient.HttpClient
      | HttpRouter.Default
      | FileSystem.FileSystem
      | BunHttpServer.BunServer
    >
  }>,
) {
  const appLayer = Function.pipe(
    Effect.tryPromise(load),
    Effect.map(v => v.default),
    Effect.orDie,
    Layer.unwrapEffect,
  )

  return Function.pipe(
    Layer.unwrapEffect(Effect.gen(function*() {
      const bunServer = yield* BunHttpServer.BunServer
      const router = yield* Effect.serviceOption(Router.Router)

      if (Option.isSome(router)) {
        const bunRoutes = yield* BunRoute.routesFromRouter(router.value)
        bunServer.addRoutes(bunRoutes)
      }

      const middlewareService = yield* StartApp.StartApp
      const middleware = yield* middlewareService.middleware

      const finalMiddleware = Function.flow(
        HttpAppExtra.handleErrors,
        middleware,
      )

      return Function.pipe(
        HttpRouter
          .Default
          .serve(finalMiddleware),
        HttpServer.withLogAddress,
      )
    })),
    Layer.provide(appLayer),
    Layer.provide([
      FetchHttpClient.layer,
      HttpRouter.Default.Live,
      BunHttpServer.layerServer({
        port: 3000,
      }),
      NodeFileSystem.layer,
      StartApp.layer(),
    ]),
    Layer.launch,
    BunRuntime.runMain,
  )
}
