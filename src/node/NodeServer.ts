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
import * as NHttp from "node:http"
import * as NOs from "node:os"
import * as NStream from "node:stream"
import * as NStreamPromises from "node:stream/promises"
import type * as Http from "../internal/Http.ts"
import * as PathPattern from "../internal/PathPattern.ts"
import * as RouteMap from "../internal/RouteMap.ts"
import type * as RouteMount from "../internal/RouteMount.ts"
import * as SocketAddress from "../internal/SocketAddress.ts"
import * as PlatformRuntime from "../PlatformRuntime.ts"
import * as Route from "../Route.ts"
import * as RouteHttp from "../RouteHttp.ts"
import * as Socket from "../Socket.ts"
import * as StartServer from "../StartServer.ts"
import * as WebSocketFrame from "./internal/WebSocketFrame.ts"

export interface NodeServeOptions {
  readonly port?: number
  readonly hostname?: string
  readonly unix?: string
}

interface PendingUpgrade {
  readonly socket: NStream.Duplex
  readonly key: string
}

// Implements StartServer (upgrade/runFork) so `Route.ws` can resolve the
// platform-agnostic tag at request time without depending on this Node module.
export type NodeServer =
  & StartServer.StartServer
  & {
    readonly [Route.IntrinsicService]?: never
    readonly server: NHttp.Server
    readonly setRoutes: (map: RouteMap.RouteMap) => Effect.Effect<void>
  }

export const NodeServer = Context.GenericTag<NodeServer>("effect-start/NodeServer")

export const make = (
  options: NodeServeOptions,
  map?: RouteMap.RouteMap,
): Effect.Effect<NodeServer, never, Scope.Scope> =>
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

    const routesReady = yield* Deferred.make<Http.WebHandler>()
    let routesAvailable = false
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

    const pendingUpgrades = new WeakMap<Request, PendingUpgrade>()
    const upgrade = makeUpgrade(pendingUpgrades)

    let boundAddress: SocketAddress.Address

    const service = NodeServer
      .of({
        get server() {
          return server
        },
        get address() {
          return boundAddress
        },
        get url() {
          if (boundAddress._tag === "UnixAddress") return "http://localhost"

          const addrHostname = boundAddress.hostname === "0.0.0.0" || boundAddress.hostname === "::"
            ? "localhost"
            : boundAddress.hostname
          return `http://${addrHostname}:${boundAddress.port}`
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
      Effect.andThen(Runtime.provideService(NodeServer, service)),
      // `Route.ws` resolves StartServer (not NodeServer) at request time, so the
      // request runtime must carry it too — backed by the same Node service.
      Effect.map(Runtime.provideService(StartServer.StartServer, service)),
    )

    const routesReadyPromise = Runtime.runPromise(runtime)(
      Deferred.await(routesReady),
    )
    let currentHandler: Http.WebHandler = (request) => {
      if (routesAvailable) {
        return new Response("not found", { status: 404 })
      }
      return routesReadyPromise.then((resume) => resume(request))
    }

    if (map !== undefined) {
      const compiled = yield* walkNodeRoutes(runtime, map)
      currentHandler = compiled.resume
      routesAvailable = true
      yield* Deferred.succeed(routesReady, compiled.resume)
    }

    const server = NHttp.createServer((req, res) => {
      handleRequest(req, res, () => currentHandler)
    })
    server.on("upgrade", (req, socket, head) => {
      handleUpgrade(req, socket, head, pendingUpgrades, () => currentHandler)
    })

    yield* Effect.async<void>((resume) => {
      server.once("error", (cause) => resume(Effect.die(cause)))
      if (options.unix !== undefined) {
        server.listen(options.unix, () => resume(Effect.void))
      } else {
        server.listen(port, hostname, () => resume(Effect.void))
      }
    })

    const listenAddress = server.address()
    boundAddress = options.unix !== undefined
      ? SocketAddress.unix(options.unix)
      : typeof listenAddress === "object" && listenAddress !== null
      ? SocketAddress.tcp(listenAddress.address, listenAddress.port)
      : SocketAddress.tcp(hostname ?? "localhost", port)

    const myFiber = MutableRef.get(PlatformRuntime.mainFiber)
    yield* Effect.addFinalizer(() =>
      Effect.async<void>((resume) => {
        // Only stop the server on real shutdown; not on hot reloads.
        const currentMain = MutableRef.get(PlatformRuntime.mainFiber)
        if (currentMain === myFiber) {
          server.close(() => resume(Effect.void))
        } else {
          resume(Effect.void)
        }
      })
    )

    yield* Deferred.succeed(setRoutesDeferred, (map) =>
      walkNodeRoutes(runtime, map)
        .pipe(
          Effect.tap((compiled) =>
            Effect.sync(() => {
              currentHandler = compiled.resume
              routesAvailable = true
            })
          ),
          Effect.tap((compiled) => Deferred.succeed(routesReady, compiled.resume)),
          Effect.asVoid,
        ))

    return service
  })

const withStartServer = <R>(
  effect: Effect.Effect<NodeServer, never, R | Scope.Scope>,
): Layer.Layer<NodeServer | StartServer.StartServer, never, Exclude<R, Scope.Scope>> =>
  Layer.scopedContext(
    Effect.map(effect, (server) =>
      Context.empty().pipe(
        Context.add(NodeServer, server),
        Context.add(StartServer.StartServer, server),
      )),
  )

/**
 * Provides HttpServer using NodeServer under the hood.
 */
export const layer = (options?: NodeServeOptions): Layer.Layer<NodeServer | StartServer.StartServer> =>
  withStartServer(make(options ?? {}))

export const layerRoutes = (
  options?: NodeServeOptions,
): Layer.Layer<NodeServer | StartServer.StartServer, never, Route.Routes> =>
  withStartServer(
    Effect.gen(function*() {
      const routes = yield* Route.Routes
      return yield* make(options ?? {}, routes)
    }),
  )

/**
 * Resolves the Node server in one place for Start.serve so routes are available:
 * 1) Reuse a user-provided NodeServer when one already exists in context.
 *    If Route.Routes are available, upgrade the existing server with them.
 * 2) Otherwise create the server from Route.Routes when routes are available.
 * 3) Otherwise create a fallback server with the default 404 handler.
 */
export const layerStart = (
  options?: NodeServeOptions,
): Layer.Layer<NodeServer | StartServer.StartServer, never, Route.Routes> =>
  withStartServer(
    Effect.gen(function*() {
      const routeMap = yield* Route.Routes
      const existing = yield* Effect.serviceOption(NodeServer)
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
        const server = yield* NodeServer
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

function walkNodeRoutes(
  runtime: Runtime.Runtime<NodeServer>,
  map: RouteMap.RouteMap,
) {
  return Effect.sync(() => {
    const pathGroups = new Map<string, Array<RouteMount.MountedRoute>>()
    for (const route of RouteMap.walk(map)) {
      const path = Route.descriptor(route).path
      const group = pathGroups.get(path) ?? []
      group.push(route)
      pathGroups.set(path, group)
    }

    const toWebHandler = RouteHttp.toWebHandlerRuntime(runtime)
    const routeHandlers: Array<{
      readonly path: string
      readonly fetch: Http.WebHandler
    }> = []
    for (const [path, routes] of pathGroups) {
      routeHandlers.push({ path, fetch: toWebHandler(routes) })
    }

    const resume: Http.WebHandler = (request) => {
      const pathname = decodeURI(new URL(request.url).pathname)
      for (const route of routeHandlers) {
        if (PathPattern.match(route.path, pathname) !== null) {
          return route.fetch(request)
        }
      }
      return new Response("not found", { status: 404 })
    }

    return { resume }
  })
}

function requestFromIncoming(
  req: NHttp.IncomingMessage,
  signal: AbortSignal,
): Request {
  const method = req.method ?? "GET"
  const host = req.headers.host ?? "localhost"
  const url = `http://${host}${req.url ?? "/"}`
  const headers = new Headers()
  for (const [key, value] of Object.entries(req.headers)) {
    if (value === undefined) continue
    if (Array.isArray(value)) {
      for (const v of value) headers.append(key, v)
    } else {
      headers.set(key, value)
    }
  }

  const hasBody = method !== "GET" && method !== "HEAD"
  return new Request(url, {
    method,
    headers,
    signal,
    ...(hasBody
      ? {
        body: NStream.Readable.toWeb(req) as unknown as ReadableStream<Uint8Array>,
        duplex: "half",
      }
      : {}),
  } as RequestInit)
}

async function writeResponse(
  res: NHttp.ServerResponse,
  response: Response,
): Promise<void> {
  res.statusCode = response.status
  response.headers.forEach((value, key) => {
    res.setHeader(key, value)
  })
  if (response.body === null) {
    res.end()
    return
  }
  try {
    await NStreamPromises.pipeline(
      NStream.Readable.fromWeb(response.body as any),
      res,
    )
  } catch {
    if (!res.writableEnded) res.end()
  }
}

function handleRequest(
  req: NHttp.IncomingMessage,
  res: NHttp.ServerResponse,
  getHandler: () => Http.WebHandler,
): void {
  const controller = new AbortController()
  res.on("close", () => {
    if (!res.writableEnded) controller.abort()
  })

  const request = requestFromIncoming(req, controller.signal)
  const handler = getHandler()

  Promise.resolve(handler(request)).then(
    (response) => writeResponse(res, response),
    (cause) => {
      // eslint-disable-next-line no-console
      console.error(cause)
      if (!res.headersSent) res.statusCode = 500
      res.end()
    },
  )
}

function handleUpgrade(
  req: NHttp.IncomingMessage,
  socket: NStream.Duplex,
  _head: Buffer,
  pendingUpgrades: WeakMap<Request, PendingUpgrade>,
  getHandler: () => Http.WebHandler,
): void {
  const key = req.headers["sec-websocket-key"]
  if (
    typeof key !== "string" ||
    (req.headers.upgrade ?? "").toLowerCase() !== "websocket"
  ) {
    socket.end("HTTP/1.1 400 Bad Request\r\n\r\n")
    return
  }

  const controller = new AbortController()
  const request = requestFromIncoming(req, controller.signal)
  pendingUpgrades.set(request, { socket, key })

  const handler = getHandler()
  Promise.resolve(handler(request)).then(
    (response) => {
      // A route calls server.upgrade() (which deletes the pending entry) once
      // it accepts the connection. If it's still pending, no ws route claimed
      // it, so respond over the raw socket the way an ordinary 404/426 would.
      if (pendingUpgrades.has(request)) {
        pendingUpgrades.delete(request)
        writeUpgradeRejection(socket, response)
      }
    },
    (cause) => {
      pendingUpgrades.delete(request)
      // eslint-disable-next-line no-console
      console.error(cause)
      if (!socket.destroyed) socket.destroy()
    },
  )
}

function writeUpgradeRejection(socket: NStream.Duplex, response: Response): void {
  if (socket.destroyed || !socket.writable) return
  const lines = [`HTTP/1.1 ${response.status} ${statusText(response.status)}`]
  response.headers.forEach((value, key) => lines.push(`${key}: ${value}`))
  lines.push("", "")
  socket.end(lines.join("\r\n"))
}

function statusText(status: number): string {
  switch (status) {
    case 400:
      return "Bad Request"
    case 404:
      return "Not Found"
    case 426:
      return "Upgrade Required"
    default:
      return "Error"
  }
}

function buildSocket(
  socket: NStream.Duplex,
  closeDeferred: Deferred.Deferred<void, Socket.SocketError>,
  ctx: { buffer: Array<Uint8Array | string>; run: (_: Uint8Array | string) => void },
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
          Deferred.await(closeDeferred),
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
            Deferred.unsafeDone(closeDeferred, Exit.void)
            if (!socket.destroyed) socket.end(WebSocketFrame.encodeClose(chunk.code, chunk.reason))
          } else if (typeof chunk === "string") {
            socket.write(WebSocketFrame.encodeText(chunk))
          } else {
            socket.write(WebSocketFrame.encodeBinary(chunk))
          }
        }))
    )
  const writer = Effect.succeed(write)

  return Socket.make({
    runRaw,
    writer,
  })
}

const makeUpgrade = (pendingUpgrades: WeakMap<Request, PendingUpgrade>) =>
(
  request: Request,
  handlerScope: Scope.Scope,
): Effect.Effect<Socket.Socket, Socket.SocketError> =>
  Effect.gen(function*() {
    const pending = pendingUpgrades.get(request)
    if (!pending) {
      return yield* Effect.fail(
        new Socket.SocketError({
          reason: new Socket.SocketOpenError({
            kind: "Unknown",
            cause: new Error("no pending websocket upgrade for this request"),
          }),
        }),
      )
    }
    pendingUpgrades.delete(request)
    const { key, socket } = pending

    const closeDeferred = yield* Deferred.make<void, Socket.SocketError>()
    const ctx = {
      buffer: [] as Array<Uint8Array | string>,
      run: undefined as any as (_: Uint8Array | string) => void,
    }
    ctx.run = (data) => {
      ctx.buffer.push(data)
    }

    const acceptKey = WebSocketFrame.acceptKeyFor(key)
    socket.write(
      "HTTP/1.1 101 Switching Protocols\r\n" +
        "Upgrade: websocket\r\n" +
        "Connection: Upgrade\r\n" +
        `Sec-WebSocket-Accept: ${acceptKey}\r\n\r\n`,
    )

    const decoder = new WebSocketFrame.FrameDecoder()

    socket.on("data", (chunk: Buffer) => {
      for (const frame of decoder.push(chunk)) {
        switch (frame.opcode) {
          case WebSocketFrame.OPCODE_TEXT: {
            ctx.run(frame.payload.toString("utf-8"))
            break
          }
          case WebSocketFrame.OPCODE_BINARY: {
            ctx.run(new Uint8Array(frame.payload))
            break
          }
          case WebSocketFrame.OPCODE_CLOSE: {
            const { code, reason } = WebSocketFrame.decodeClosePayload(frame.payload)
            Deferred.unsafeDone(
              closeDeferred,
              Exit.fail(
                new Socket.SocketError({
                  reason: new Socket.SocketCloseError({ code, closeReason: reason }),
                }),
              ),
            )
            if (!socket.destroyed) {
              // 1005 ("no status received") is a sentinel for a code-less close
              // frame and must never appear on the wire — echo an empty close
              // frame instead of re-encoding it.
              socket.end(
                frame.payload.length === 0
                  ? WebSocketFrame.encodeFrame(WebSocketFrame.OPCODE_CLOSE, new Uint8Array(0))
                  : WebSocketFrame.encodeClose(code),
              )
            }
            break
          }
          case WebSocketFrame.OPCODE_PING: {
            socket.write(WebSocketFrame.encodeFrame(WebSocketFrame.OPCODE_PONG, frame.payload))
            break
          }
            // Pongs and continuation frames (already reassembled by the
            // decoder) need no further action here.
        }
      }
    })
    socket.on("error", (cause) => {
      Deferred.unsafeDone(
        closeDeferred,
        Exit.fail(
          new Socket.SocketError({
            reason: new Socket.SocketReadError({ cause }),
          }),
        ),
      )
    })
    socket.on("close", () => {
      Deferred.unsafeDone(
        closeDeferred,
        Exit.fail(
          new Socket.SocketError({
            reason: new Socket.SocketCloseError({ code: 1006 }),
          }),
        ),
      )
    })

    yield* Scope.addFinalizerExit(
      handlerScope,
      (exit) =>
        Effect.flatMap(Deferred.isDone(closeDeferred), (clientClosed) =>
          clientClosed
            ? Effect.void
            : Effect.sync(() => {
              if (!socket.destroyed) {
                socket.end(WebSocketFrame.encodeClose(Exit.isSuccess(exit) ? 1000 : 1011))
              }
            })),
    )

    return buildSocket(socket, closeDeferred, ctx)
  })

function getLocalIp(): string | undefined {
  return Object
    .values(NOs.networkInterfaces())
    .flatMap((addresses) => addresses ?? [])
    .find((addr) => addr.family === "IPv4" && !addr.internal)
    ?.address
}
