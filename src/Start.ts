import * as BunContext from "@effect/platform-bun/BunContext"
import * as BunHttpServer from "@effect/platform-bun/BunHttpServer"
import * as BunRuntime from "@effect/platform-bun/BunRuntime"
import * as FetchHttpClient from "@effect/platform/FetchHttpClient"
import * as HttpApp from "@effect/platform/HttpApp"
import * as HttpClient from "@effect/platform/HttpClient"
import * as HttpRouter from "@effect/platform/HttpRouter"
import * as HttpServer from "@effect/platform/HttpServer"
import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Function from "effect/Function"
import * as Layer from "effect/Layer"
import * as Ref from "effect/Ref"
import * as BunBundle from "./bun/BunBundle.ts"
import * as Bundle from "./Bundle.ts"
import * as BundleHttp from "./BundleHttp.ts"
import * as FileRouter from "./FileRouter.ts"
import * as HttpAppExtra from "./HttpAppExtra.ts"
import * as Router from "./Router.ts"

type StartMiddleware = <E, R>(
  self: HttpApp.Default<E, R>,
) => HttpApp.Default<never, never>

export class Start extends Context.Tag("effect-start/Start")<
  Start,
  {
    readonly env: "development" | "production" | string
    readonly relativeUrlRoot?: string
    readonly addMiddleware: (
      middleware: StartMiddleware,
    ) => Effect.Effect<void>
    readonly middleware: Ref.Ref<StartMiddleware>
  }
>() {
}

export function layer(options?: {
  env?: string
}) {
  return Layer.sync(Start, () => {
    const env = options?.env ?? process.env.NODE_ENV ?? "development"
    const middleware = Ref.unsafeMake(
      Function.identity as StartMiddleware,
    )

    return Start.of({
      env,
      middleware,
      addMiddleware: (f) =>
        Ref.update(middleware, (prev) => (app) => f(prev(app))),
    })
  })
}

export function router(
  load: () => Promise<Router.RouteManifest>,
) {
  return Layer.provideMerge(
    // add it to BundleHttp
    Layer.effectDiscard(
      Effect.gen(function*() {
        const httpRouter = yield* HttpRouter.Default
        const startRouter = yield* Router.Router

        yield* httpRouter.concat(startRouter.httpRouter)
      }),
    ),
    Layer.merge(
      Router.layerPromise(load),
      FileRouter.layer(),
    ),
  )
}

export function bundleClient(config: BunBundle.BuildOptions | string) {
  const clientLayer = Layer.effect(
    Bundle.ClientBundle,
    BunBundle.buildClient(config),
  )
  const assetsLayer = Layer.effectDiscard(Effect.gen(function*() {
    const router = yield* HttpRouter.Default
    const app = BundleHttp.toHttpApp(Bundle.ClientBundle)

    yield* router.mountApp(
      "/_bundle",
      app,
    )
  }))

  return Layer.mergeAll(
    clientLayer,
    assetsLayer,
  )
}

export function make<
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
      | HttpRouter.Default
      | HttpClient.HttpClient
      | BunContext.BunContext
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
      const middlewareService = yield* Start
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
      BunHttpServer.layer({
        port: 3000,
      }),
      layer(),
    ]),
    Layer.launch,
    BunRuntime.runMain,
  )
}
