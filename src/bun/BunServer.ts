import * as Socket from "@effect/platform/Socket"
import * as Bun from "bun"
import * as Config from "effect/Config"
import * as Context from "effect/Context"
import * as Deferred from "effect/Deferred"
import * as Effect from "effect/Effect"
import * as Exit from "effect/Exit"
import * as Layer from "effect/Layer"
import * as Option from "effect/Option"
import type * as Scope from "effect/Scope"
import * as PathPattern from "../PathPattern.ts"
import * as PlataformRuntime from "../PlatformRuntime.ts"
import * as Route from "../Route.ts"
import * as RouteHttp from "../RouteHttp.ts"
import * as RouteMount from "../RouteMount.ts"
import * as RouteTree from "../RouteTree.ts"
import * as Unique from "../Unique.ts"
import EmptyHTML from "./_empty.html"
import * as BunRoute from "./BunRoute.ts"
import * as BunServerRequest from "./BunServerRequest.ts"

type FetchHandler = (
  request: Request,
  server: Bun.Server<BunServerRequest.WebSocketContext>,
) => Response | Promise<Response>

/**
 * Basically `Omit<Bun.Serve.Options, "fetch" | "error" | "websocket">`
 * TypeScript 5.9 cannot verify discriminated union types used in
 * {@link Bun.serve} so we need to define them explicitly.
 */
interface BunServeOptions {
  readonly port?: number
  readonly hostname?: string
  readonly reusePort?: boolean
  readonly ipv6Only?: boolean
  readonly idleTimeout?: number
  readonly development?: boolean
}

export type BunServer = {
  readonly server: Bun.Server<BunServerRequest.WebSocketContext>
  readonly pushHandler: (fetch: FetchHandler) => void
  readonly popHandler: () => void
}

export const BunServer = Context.GenericTag<BunServer>(
  "effect-start/BunServer",
)

export const make = (
  options: BunServeOptions,
): Effect.Effect<
  BunServer,
  never,
  Scope.Scope
> =>
  Effect.gen(function*() {
    const routes = yield* Effect.serviceOption(Route.Routes).pipe(
      Effect.andThen(Option.getOrUndefined),
    )

    const port = yield* Config.number("PORT").pipe(
      Effect.catchTag("ConfigError", () => {
        if (PlataformRuntime.isAgentHarness()) {
          // use random port
          return Effect.succeed(0)
        }

        return Effect.succeed(3000)
      }),
    )
    const hostname = yield* Config.string("HOSTNAME").pipe(
      Effect.catchTag("ConfigError", () => Effect.succeed(undefined)),
    )

    const handlerStack: Array<FetchHandler> = [
      function(_request, _server) {
        return new Response("not found", { status: 404 })
      },
    ]

    let currentRoutes: BunRoute.BunRoutes = {}

    // Bun HMR doesn't work on successive calls to `server.reload` if there are no routes
    // on server start. We workaround that by passing a dummy HTMLBundle [2025-11-26]
    // see: https://github.com/oven-sh/bun/issues/23564
    currentRoutes[`/.BunEmptyHtml-${Unique.token(10)}`] = EmptyHTML

    const websocket: Bun.WebSocketHandler<BunServerRequest.WebSocketContext> = {
      open(ws) {
        Deferred.unsafeDone(ws.data.deferred, Exit.succeed(ws))
      },
      message(ws, message) {
        ws.data.run(message)
      },
      close(ws, code, closeReason) {
        Deferred.unsafeDone(
          ws.data.closeDeferred,
          Socket.defaultCloseCodeIsError(code)
            ? Exit.fail(
              new Socket.SocketCloseError({
                reason: "Close",
                code,
                closeReason,
              }),
            )
            : Exit.void,
        )
      },
    }

    const server = Bun.serve({
      port,
      hostname,
      ...options,
      routes: currentRoutes,
      fetch: handlerStack[0],
      websocket,
    })

    yield* Effect.addFinalizer(() =>
      Effect.sync(() => {
        server.stop()
      })
    )

    const reload = () => {
      server.reload({
        fetch: handlerStack[handlerStack.length - 1],
        routes: currentRoutes,
        websocket,
      })
    }

    const bunServer = BunServer.of({
      server,
      pushHandler(fetch) {
        handlerStack.push(fetch)
        reload()
      },
      popHandler() {
        handlerStack.pop()
        reload()
      },
    })

    if (routes) {
      const walkedRoutes = yield* walkBunRoutes(routes).pipe(
        Effect.provideService(BunServer, bunServer),
      )
      Object.assign(currentRoutes, walkedRoutes)
      reload()
    }

    return bunServer
  })

/**
 * Provides HttpServer using BunServer under the hood.
 */
export const layer = (
  options?: BunServeOptions,
): Layer.Layer<BunServer> =>
  Layer.scoped(
    BunServer,
    make(options ?? {}),
  )

export const withLogAddress = <A, E, R>(
  layer: Layer.Layer<A, E, R>,
) =>
  Layer
    .effectDiscard(
      BunServer.pipe(
        Effect.andThen(server =>
          Effect.log(
            `Listening on ${server.server.hostname}:${server.server.port}`,
          )
        ),
      ),
    )
    .pipe(
      Layer.provideMerge(layer),
    )

function walkBunRoutes(
  tree: RouteTree.RouteTree,
) {
  return Effect.gen(function*() {
    const runtime = yield* Effect.runtime()
    const bunRoutes: BunRoute.BunRoutes = {}
    const pathGroups = new Map<string, RouteMount.MountedRoute[]>()
    const toWebHandler = RouteHttp.toWebHandlerRuntime(runtime)

    for (const route of RouteTree.walk(tree)) {
      const bunDescriptors = BunRoute.descriptors(route)
      if (bunDescriptors) {
        const htmlBundle = yield* Effect.promise(bunDescriptors.bunLoad)
        bunRoutes[`${bunDescriptors.bunPrefix}/*`] = htmlBundle
      }

      const path = Route.descriptor(route).path
      const group = pathGroups.get(path) ?? []
      group.push(route)
      pathGroups.set(path, group)
    }

    for (const [path, routes] of pathGroups) {
      const handler = toWebHandler(routes)
      for (const bunPath of PathPattern.toBun(path)) {
        bunRoutes[bunPath] = handler
      }
    }

    return bunRoutes
  })
}
