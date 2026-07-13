import * as Bun from "bun"
import * as Config from "effect/Config"
import * as Context from "effect/Context"
import * as Deferred from "effect/Deferred"
import * as Effect from "effect/Effect"
import * as Exit from "effect/Exit"
import * as FiberSet from "effect/FiberSet"
import * as Layer from "effect/Layer"
import * as MutableRef from "effect/MutableRef"
import * as Option from "effect/Option"
import * as Runtime from "effect/Runtime"
import * as Scope from "effect/Scope"
import * as NOs from "node:os"
import * as NPath from "node:path"
import * as PathPattern from "../internal/PathPattern.ts"
import * as RouteMap from "../internal/RouteMap.ts"
import type * as RouteMount from "../internal/RouteMount.ts"
import * as SocketAddress from "../internal/SocketAddress.ts"
import * as PlatformRuntime from "../PlatformRuntime.ts"
import * as Route from "../Route.ts"
import * as RouteHttp from "../RouteHttp.ts"
import * as Socket from "../Socket.ts"
import * as StartServer from "../StartServer.ts"
import * as BunRoute from "./BunRoute.ts"

export interface WebSocketContext {
  readonly deferred: Deferred.Deferred<Bun.ServerWebSocket<WebSocketContext>>
  // Resolves the connection lifetime: a failure carries the SocketCloseError
  // for a peer-initiated close, a success means the close was intentional
  // (the handler wrote a CloseEvent, or the scope ended).
  readonly closeDeferred: Deferred.Deferred<void, Socket.SocketError>
  readonly buffer: Array<Uint8Array | string>
  run: (_: Uint8Array | string) => void
}

type FetchHandler = (
  request: Request,
  server: Bun.Server<WebSocketContext>,
) => Response | Promise<Response>

/**
 * Basically `Omit<Bun.Serve.Options, "fetch" | "error" | "websocket">`
 * TypeScript 5.9 cannot verify discriminated union types used in
 * {@link Bun.serve} so we need to define them explicitly.
 */
interface BunServeOptions {
  readonly port?: number
  readonly hostname?: string
  readonly unix?: string
  readonly reusePort?: boolean
  readonly ipv6Only?: boolean
  readonly idleTimeout?: number
  readonly development?: Bun.Serve.Development
}

// Implements StartServer (upgrade/runFork) so `Route.ws` can resolve the
// platform-agnostic tag at request time without depending on this Bun module.
export type BunServer =
  & StartServer.StartServer
  & {
    readonly [Route.IntrinsicService]?: never
    readonly server: Bun.Server<WebSocketContext>
    readonly pushHandler: (fetch: FetchHandler) => void
    readonly popHandler: () => void
    readonly setRoutes: (map: RouteMap.RouteMap) => Effect.Effect<void>
  }

export const BunServer = Context.GenericTag<BunServer>("effect-start/BunServer")

export const make = (
  options: BunServeOptions,
  map?: RouteMap.RouteMap,
): Effect.Effect<BunServer, never, Scope.Scope> =>
  Effect.gen(function*() {
    const port = yield* Config.number("PORT").pipe(
      Effect.catchTag("ConfigError", () => {
        return PlatformRuntime.isAgentHarness()
          ? Effect.succeed(0) // random port
          : Effect.succeed(3000)
      }),
    )
    const hostFlag = process.argv.includes("--host")
    const hostname = yield* Config.string("HOST").pipe(
      Effect.catchTag("ConfigError", () => Effect.succeed(hostFlag ? "0.0.0.0" : undefined)),
    )

    const handlerStack: Array<FetchHandler> = [
      function(_request, _server) {
        return new Response("not found", { status: 404 })
      },
    ]

    const setRoutesDeferred = yield* Deferred
      .make<(map: RouteMap.RouteMap) => Effect.Effect<void>>()

    // Socket handlers are forked into the server's scope. When the server shuts
    // down this scope closes, interrupting every live handler so their scopes
    // (and any acquired resources) are released instead of leaking. forkIn
    // preserves the caller's requirements, so the handler keeps the app's R.
    const handlerScope = yield* Effect.scope
    const runFork = <R>(
      effect: Effect.Effect<void, never, R>,
    ): Effect.Effect<void, never, R> => Effect.asVoid(Effect.forkIn(effect, handlerScope))

    let boundServer: Bun.Server<WebSocketContext>
    let boundAddress: SocketAddress.Address
    const upgrade = makeUpgrade(() => boundServer)

    const service = BunServer
      .of({
        get server() {
          return boundServer
        },
        get address() {
          return boundAddress
        },
        get url() {
          if (boundAddress._tag === "UnixAddress") return "http://localhost"

          const hostname = boundAddress.hostname === "0.0.0.0" || boundAddress.hostname === "::"
            ? "localhost"
            : boundAddress.hostname
          return `http://${hostname}:${boundAddress.port}`
        },
        pushHandler(fetch) {
          handlerStack
            .push(fetch)
          reload()
        },
        popHandler() {
          handlerStack.pop()
          reload()
        },
        setRoutes(map) {
          return Deferred.await(setRoutesDeferred).pipe(
            Effect.flatMap((applyRoutes) => applyRoutes(map)),
          )
        },
        upgrade,
        runFork,
      })

    const runtime = yield* Effect.runtime().pipe(
      Effect.andThen(Runtime.provideService(BunServer, service)),
      // `Route.ws` resolves StartServer (not BunServer) at request time, so the
      // request runtime must carry it too — backed by the same Bun service.
      Effect.map(Runtime.provideService(StartServer.StartServer, service)),
    )

    let currentRoutes: BunRoute.BunRoutes = map
      ? yield* walkBunRoutes(runtime, map)
      : {}
    let websocketEnabled = map
      ? hasWebSocketRoute(map)
      : false

    const websocket: Bun.WebSocketHandler<WebSocketContext> = {
      open(ws) {
        Deferred.unsafeDone(ws.data.deferred, Exit.succeed(ws))
      },
      message(ws, message) {
        ws.data.run(message)
      },
      close(ws, code, closeReason) {
        Deferred.unsafeDone(
          ws.data.closeDeferred,
          Exit.fail(
            new Socket.SocketError({
              reason: new Socket.SocketCloseError({
                code,
                closeReason,
              }),
            }),
          ),
        )
      },
    }

    const server = Bun.serve({
      ...(options.unix !== undefined ? {} : { port, hostname }),
      ...options,
      routes: currentRoutes,
      fetch: handlerStack[0],
      ...(websocketEnabled ? { websocket } : {}),
    } as Bun.Serve.Options<WebSocketContext>)

    boundServer = server
    boundAddress = options.unix !== undefined
      ? SocketAddress.unix(options.unix)
      : SocketAddress.tcp(server.hostname!, server.port!)

    const myFiber = MutableRef.get(PlatformRuntime.mainFiber)
    yield* Effect.addFinalizer(() =>
      Effect.sync(() => {
        // Only stop the server on real shutdown; and not on hot reloads
        // when Bun.serve automatically swaps routes without restarting the server
        const currentMain = MutableRef.get(PlatformRuntime.mainFiber)
        if (currentMain === myFiber) {
          server.stop()
        }
      })
    )

    const reload = () => {
      server.reload({
        fetch: handlerStack[handlerStack.length - 1],
        routes: currentRoutes,
        ...(websocketEnabled ? { websocket } : {}),
      })
    }

    yield* Deferred.succeed(setRoutesDeferred, (map) =>
      walkBunRoutes(runtime, map)
        .pipe(
          Effect
            .tap((bunRoutes) =>
              Effect.sync(() => {
                currentRoutes = bunRoutes
                websocketEnabled = websocketEnabled || hasWebSocketRoute(map)
                reload()
              })
            ),
          Effect.asVoid,
        ))

    return service
  })

const withStartServer = <R>(
  effect: Effect.Effect<BunServer, never, R | Scope.Scope>,
): Layer.Layer<BunServer | StartServer.StartServer, never, Exclude<R, Scope.Scope>> =>
  Layer.scopedContext(
    Effect.map(effect, (server) =>
      Context.empty().pipe(
        Context.add(BunServer, server),
        Context.add(StartServer.StartServer, server),
      )),
  )

/**
 * Provides HttpServer using BunServer under the hood.
 */
export const layer = (options?: BunServeOptions): Layer.Layer<BunServer | StartServer.StartServer> =>
  withStartServer(make(options ?? {}))

export const layerRoutes = (
  options?: BunServeOptions,
): Layer.Layer<BunServer | StartServer.StartServer, never, Route.Routes> =>
  withStartServer(
    Effect.gen(function*() {
      const routes = yield* Route.Routes
      return yield* make(options ?? {}, routes)
    }),
  )

/**
 * Resolves the Bun server in one place for Start.serve so routes are available:
 * 1) Reuse a user-provided BunServer when one already exists in context.
 *    If Route.Routes are available, upgrade the existing server with them.
 * 2) Otherwise create the server from Route.Routes when routes are available.
 * 3) Otherwise create a fallback server with the default 404 handler.
 */
export const layerStart = (
  options?: BunServeOptions,
): Layer.Layer<BunServer | StartServer.StartServer, never, Route.Routes> =>
  withStartServer(
    Effect.gen(function*() {
      const routeMap = yield* Route.Routes
      const existing = yield* Effect.serviceOption(BunServer)
      if (Option.isSome(existing)) {
        yield* existing.value.setRoutes(routeMap)
        return existing.value
      }
      return yield* make(options ?? {}, routeMap)
    }),
  )

export const withLogAddress = <A, E, R>(layer: Layer.Layer<A, E, R>) =>
  Layer
    .effectDiscard(
      Effect.gen(function*() {
        const server = yield* BunServer
        if (server.address._tag === "UnixAddress") {
          yield* Effect.log(`Listening on unix:${server.address.path}`)
        } else {
          const host = server.address.hostname === "0.0.0.0"
            ? (getLocalIp() ?? "localhost")
            : "localhost"
          yield* Effect.log(`Listening on http://${host}:${server.address.port}`)
        }
      }),
    )
    .pipe(Layer.provideMerge(layer))

const hasWebSocketRoute = (map: RouteMap.RouteMap): boolean =>
  [...RouteMap.walk(map)].some((r) => Route.descriptor<{ protocol?: "ws" }>(r).protocol === "ws")

function walkBunRoutes(
  runtime: Runtime.Runtime<BunServer>,
  map: RouteMap.RouteMap,
) {
  return Effect.gen(function*() {
    const bunRoutes: BunRoute.BunRoutes = {}
    const pathGroups = new Map<string, Array<RouteMount.MountedRoute>>()
    const toWebHandler = RouteHttp.toWebHandlerRuntime(runtime)

    let hasPrebuiltBundles = false

    for (const route of RouteMap.walk(map)) {
      const bunDescriptors = BunRoute.descriptors(route)
      if (bunDescriptors) {
        const htmlBundle = yield* Effect.promise(bunDescriptors.bunLoad)
        if (htmlBundle.files) {
          hasPrebuiltBundles = true
          registerPrebuiltBundle(
            bunDescriptors.bunPrefix,
            htmlBundle,
            bunRoutes,
          )
        } else {
          bunRoutes[`${bunDescriptors.bunPrefix}/*`] = htmlBundle
        }
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

    if (hasPrebuiltBundles) {
      const mainDir = NPath.dirname(Bun.main)
      for (const output of discoverStaticOutputs(mainDir)) {
        const routePath = `/${NPath.basename(output.path)}`
        if (routePath in bunRoutes) continue
        bunRoutes[routePath] = Bun.file(output.path)
      }
    }

    return bunRoutes
  })
}

function buildSocket(
  ws: Bun.ServerWebSocket<WebSocketContext>,
  ctx: WebSocketContext,
): Socket.Socket {
  const latch = Effect.unsafeMakeLatch(false)
  let closed = false

  const runRaw = <_, E, R>(
    handler: (_: string | Uint8Array) => Effect.Effect<_, E, R> | void,
    opts?: { readonly onOpen?: Effect.Effect<void> | undefined },
  ): Effect.Effect<void, Socket.SocketError | E, R> =>
    Effect
      .scopedWith(Effect.fnUntraced(function*(scope) {
        const fiberSet = yield* FiberSet
          .make<any, E | Socket.SocketError>()
          .pipe(Scope.extend(scope))
        const run = yield* FiberSet.runtime(fiberSet)<R>()

        ctx.run = (data) => {
          const result = handler(data)
          if (Effect.isEffect(result)) {
            run(result)
          }
        }
        for (const data of ctx.buffer) {
          ctx.run(data)
        }
        ctx.buffer.length = 0

        yield* latch.open
        if (opts?.onOpen) yield* opts.onOpen

        return yield* Effect.raceFirst(
          FiberSet.join(fiberSet),
          Deferred.await(ctx.closeDeferred),
        )
      }))
      .pipe(
        Effect.ensuring(Effect.sync(() => {
          closed = true
          latch.unsafeClose()
          ctx.run = (data) => {
            ctx.buffer.push(data)
          }
        })),
        Effect.interruptible,
      )

  // Once the socket is closed the latch never reopens, so a write would park
  // forever. Fail fast with a SocketWriteError instead of hanging.
  const write = (chunk: Uint8Array | string | Socket.CloseEvent) =>
    Effect.suspend(() =>
      closed
        ? Effect.fail(
          new Socket.SocketError({
            reason: new Socket.SocketWriteError({
              cause: new Error("write on a closed socket"),
            }),
          }),
        )
        : latch.whenOpen(Effect.sync(() => {
          if (Socket.isCloseEvent(chunk)) {
            Deferred.unsafeDone(ctx.closeDeferred, Exit.void)
            ws.close(chunk.code, chunk.reason)
          } else if (typeof chunk === "string") {
            ws.sendText(chunk)
          } else {
            ws.sendBinary(chunk)
          }
        }))
    )
  const writer = Effect.succeed(write)

  return Socket.make({
    runRaw,
    writer,
  })
}

const makeUpgrade = (getServer: () => Bun.Server<WebSocketContext>) =>
(
  request: Request,
  handlerScope: Scope.Scope,
): Effect.Effect<Socket.Socket, Socket.SocketError> =>
  Effect.gen(function*() {
    const deferred = yield* Deferred
      .make<Bun.ServerWebSocket<WebSocketContext>>()
    const closeDeferred = yield* Deferred.make<void, Socket.SocketError>()
    const ctx: WebSocketContext = {
      deferred,
      closeDeferred,
      buffer: [],
      run: undefined as any,
    }
    ctx.run = (data) => {
      ctx.buffer.push(data)
    }

    const ok = getServer().upgrade(request, { data: ctx })
    if (!ok) {
      return yield* Effect.fail(
        new Socket.SocketError({
          reason: new Socket.SocketOpenError({
            kind: "Unknown",
            cause: new Error("Bun declined the websocket upgrade"),
          }),
        }),
      )
    }

    const ws = yield* Deferred.await(ctx.deferred)

    yield* Scope.addFinalizerExit(
      handlerScope,
      (exit) =>
        Effect.flatMap(Deferred.isDone(ctx.closeDeferred), (clientClosed) =>
          clientClosed ?
            Effect.void :
            Effect.sync(() => {
              ws.close(Exit.isSuccess(exit) ? 1000 : 1011)
            })),
    )

    return buildSocket(ws, ctx)
  })

function registerPrebuiltBundle(
  prefix: string,
  bundle: any,
  bunRoutes: BunRoute.BunRoutes,
) {
  const mainDir = NPath.dirname(Bun.main)
  const indexPath = NPath.resolve(mainDir, bundle.index)

  const htmlPromise = rewriteRelativeAssetPaths(Bun.file(indexPath).text())

  bunRoutes[`${prefix}/*`] = async () =>
    new Response(await htmlPromise, {
      headers: { "content-type": "text/html;charset=utf-8" },
    })

  for (const file of bundle.files ?? []) {
    if (file.loader === "html") continue
    const absPath = NPath.resolve(mainDir, file.path)
    const basename = NPath.basename(file.path)
    bunRoutes[`/${basename}`] = () => new Response(Bun.file(absPath), { headers: file.headers ?? {} })
  }
}

type StaticOutput = Pick<Bun.BuildArtifact, "path" | "loader" | "kind">

function discoverStaticOutputs(dir: string): Array<StaticOutput> {
  const loaderByExt: Record<string, Bun.Loader> = {
    ".js": "js",
    ".mjs": "js",
    ".cjs": "js",
    ".jsx": "jsx",
    ".tsx": "tsx",
    ".ts": "ts",
    ".css": "css",
    ".html": "html",
    ".json": "json",
    ".jsonc": "jsonc",
    ".toml": "toml",
    ".yaml": "yaml",
    ".wasm": "wasm",
    ".txt": "text",
  }

  const outputs: Array<StaticOutput> = []
  for (
    const entry of new Bun.Glob("*").scanSync({ cwd: dir, onlyFiles: true })
  ) {
    const ext = NPath.extname(entry).toLowerCase()
    outputs.push({
      path: NPath.resolve(dir, entry),
      loader: loaderByExt[ext] ?? "file",
      kind: "asset",
    })
  }
  return outputs
}

function rewriteRelativeAssetPaths(
  html: string | Promise<string>,
): Promise<string> {
  const rewriter = new HTMLRewriter()
    .on("link[href]", {
      element(el) {
        const href = el.getAttribute("href")
        if (href && isRelativePath(href)) {
          el.setAttribute("href", "/" + assetBasename(href))
        }
      },
    })
    .on("script[src]", {
      element(el) {
        const src = el.getAttribute("src")
        if (src && isRelativePath(src)) {
          el.setAttribute("src", "/" + assetBasename(src))
        }
      },
    })
    .on("img[src]", {
      element(el) {
        const src = el.getAttribute("src")
        if (src && isRelativePath(src)) {
          el.setAttribute("src", "/" + assetBasename(src))
        }
      },
    })

  return Promise.resolve(html).then((h) => rewriter.transform(new Response(h)).text())
}

function isRelativePath(path: string): boolean {
  return path.startsWith("./") || path.startsWith("../")
}

function assetBasename(path: string): string {
  const i = path.lastIndexOf("/")
  return i === -1 ? path : path.slice(i + 1)
}

function getLocalIp(): string | undefined {
  return Object
    .values(NOs.networkInterfaces())
    .flatMap((addresses) => addresses ?? [])
    .find((addr) => addr.family === "IPv4" && !addr.internal)
    ?.address
}
