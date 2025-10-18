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
import * as Option from "effect/Option"
import * as Ref from "effect/Ref"
import * as NNet from "node:net"
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

export class StartDevelopment extends Context.Tag(
  "effect-start/StartDevelopment",
)<StartDevelopment, { readonly enabled: boolean }>() {
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

export function development(options?: {
  enabled?: boolean
}) {
  return Layer.sync(StartDevelopment, () => {
    const env = process.env.NODE_ENV ?? "development"
    const enabled = options?.enabled ?? env !== "production"

    return StartDevelopment.of({
      enabled,
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
  const assetsLayer = Layer.effectDiscard(Effect.gen(function*() {
    const router = yield* HttpRouter.Default
    const app = BundleHttp.toHttpApp(Bundle.ClientBundle)

    yield* router.mountApp(
      "/_bundle",
      app,
    )
  }))

  return Layer.unwrapEffect(Effect.gen(function*() {
    const development = yield* Effect.serviceOption(StartDevelopment)
    const env = process.env.NODE_ENV ?? "development"
    const isDevelopment = Option.match(development, {
      onNone: () => env !== "production",
      onSome: (dev) => dev.enabled,
    })
    const resolvedConfig = BunBundle.resolveClientBuildConfig(config)
    const bundleLayer = isDevelopment
      ? BunBundle.layerDev(
        Bundle.ClientBundle,
        resolvedConfig,
      )
      : Layer.effect(
        Bundle.ClientBundle,
        BunBundle.build(resolvedConfig),
      )

    return Layer.mergeAll(
      bundleLayer,
      assetsLayer,
    )
  }))
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
  options?: {
    port?: number
    host?: string
  },
) {
  const appLayer = Function.pipe(
    Effect.tryPromise(load),
    Effect.map((v) => v.default),
    Effect.orDie,
    Layer.unwrapEffect,
  )
  const serverLayer = Layer.unwrapEffect(Effect.gen(function*() {
    const host = options?.host ?? process.env.HOST
    const requestedPort = resolvePreferredPort(
      options?.port,
      process.env.PORT,
    )
    const portInfo = yield* findAvailablePort(
      requestedPort,
      host,
    )

    if (portInfo.port !== portInfo.requestedPort) {
      yield* Effect.logWarning(
        `Port ${portInfo.requestedPort} is in use, switching to ${portInfo.port}`,
      )
    }

    const serveOptions: {
      port: number
      hostname?: string
    } = {
      port: portInfo.port,
    }

    if (host) {
      serveOptions.hostname = host
    }

    return BunHttpServer.layer(serveOptions)
  }))

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
      serverLayer,
      layer(),
    ]),
    Layer.launch,
    BunRuntime.runMain,
  )
}

const DefaultPort = 3000

const resolvePreferredPort = (
  port: number | undefined,
  envPort: string | undefined,
) => {
  if (typeof port === "number" && Number.isFinite(port) && port >= 0) {
    return Math.floor(port)
  }

  const parsedEnvPort = parseEnvPort(envPort)

  if (parsedEnvPort !== undefined) {
    return parsedEnvPort
  }

  return DefaultPort
}

const parseEnvPort = (value: string | undefined) => {
  if (!value) {
    return undefined
  }

  const parsed = Number.parseInt(value, 10)

  if (Number.isNaN(parsed) || parsed < 0) {
    return undefined
  }

  return parsed
}

const attemptListen = (
  port: number,
  host: string | undefined,
) =>
  Effect.tryPromise({
    try: () =>
      new Promise<number>((resolve, reject) => {
        const server = NNet.createServer()

        server.unref()

        const complete = () => {
          server.close(() => resolve(port))
        }
        const fail = (error: NodeJS.ErrnoException) => {
          server.close(() => reject(error))
        }

        server.once("listening", complete)
        server.once("error", fail)
        server.listen({
          port,
          host,
          exclusive: true,
        })
      }),
    catch: (error) => error as NodeJS.ErrnoException,
  })

const findAvailablePort = (
  requestedPort: number,
  host: string | undefined,
) => {
  return Effect.gen(function*() {
    let port = requestedPort

    while (true) {
      const result = yield* Effect.either(
        attemptListen(port, host),
      )

      if (result._tag === "Right") {
        return {
          port: result.right,
          requestedPort,
        }
      }

      const error = result.left

      if (error?.code === "EADDRINUSE") {
        port = port + 1
        continue
      }

      return yield* Effect.fail(error)
    }
  })
}
