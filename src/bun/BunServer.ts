import * as Socket from "../Socket.ts"
import * as Bun from "bun"
import * as Config from "effect/Config"
import * as Context from "effect/Context"
import * as Deferred from "effect/Deferred"
import * as Effect from "effect/Effect"
import * as Exit from "effect/Exit"
import * as Layer from "effect/Layer"
import * as Option from "effect/Option"
import * as Runtime from "effect/Runtime"
import type * as Scope from "effect/Scope"
import * as NOs from "node:os"
import * as NPath from "node:path"
import * as PathPattern from "../_PathPattern.ts"
import * as PlatformRuntime from "../PlatformRuntime.ts"
import * as Route from "../Route.ts"
import * as RouteHttp from "../RouteHttp.ts"
import * as StartApp from "../_StartApp.ts"
import type * as RouteMount from "../RouteMount.ts"
import * as RouteTree from "../RouteTree.ts"
import * as BunRoute from "./BunRoute.ts"
export interface WebSocketContext {
  readonly deferred: Deferred.Deferred<Bun.ServerWebSocket<WebSocketContext>>
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
  readonly reusePort?: boolean
  readonly ipv6Only?: boolean
  readonly idleTimeout?: number
  readonly development?: boolean
}

export type BunServer = {
  readonly server: Bun.Server<WebSocketContext>
  readonly pushHandler: (fetch: FetchHandler) => void
  readonly popHandler: () => void
}

export const BunServer = Context.GenericTag<BunServer>("effect-start/BunServer")

export const make = (
  options: BunServeOptions,
  tree?: RouteTree.RouteTree,
): Effect.Effect<BunServer, never, Scope.Scope> =>
  Effect.gen(function* () {
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
      function (_request, _server) {
        return new Response("not found", { status: 404 })
      },
    ]

    const service = BunServer.of({
      // During the construction we need to create a service imlpementation
      // first so we can provide it in the runtime that will be used in web
      // handlers. After we create the runtime, we set it below so it's always
      // available at runtime.
      // An alternative approach would be to use Bun.Server.reload but I prefer
      // to avoid it since it's badly documented and has bunch of bugs.
      server: undefined as any,
      pushHandler(fetch) {
        handlerStack.push(fetch)
        reload()
      },
      popHandler() {
        handlerStack.pop()
        reload()
      },
    })

    const runtime = yield* Effect.runtime().pipe(
      Effect.andThen(Runtime.provideService(BunServer, service)),
    )

    let currentRoutes: BunRoute.BunRoutes = tree ? yield* walkBunRoutes(runtime, tree) : {}

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
          Socket.defaultCloseCodeIsError(code)
            ? Exit.fail(
                new Socket.SocketError({
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

    // @ts-expect-error
    service.server = server

    yield* Effect.addFinalizer(() =>
      Effect.sync(() => {
        server.stop()
      }),
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

    return bunServer
  })

/**
 * Provides HttpServer using BunServer under the hood.
 */
export const layer = (options?: BunServeOptions): Layer.Layer<BunServer> =>
  Layer.scoped(BunServer, make(options ?? {}))

export const layerRoutes = (
  options?: BunServeOptions,
): Layer.Layer<BunServer, never, Route.Routes> =>
  Layer.scoped(
    BunServer,
    Effect.gen(function* () {
      const routes = yield* Route.Routes
      return yield* make(options ?? {}, routes)
    }),
  )

/**
 * Resolves the Bun server in one place for Start.serve so routes are available:
 * 1) Reuse a user-provided BunServer when one already exists in context.
 * 2) Otherwise create the server from Route.Routes when routes are available.
 * 3) Otherwise create a fallback server with the default 404 handler.
 */
export const layerStart = (
  options?: BunServeOptions,
): Layer.Layer<BunServer, never, StartApp.StartApp> =>
  Layer.scoped(
    BunServer,
    Effect.gen(function* () {
      const app = yield* StartApp.StartApp
      const existing = yield* Effect.serviceOption(BunServer)
      if (Option.isSome(existing)) {
        yield* Deferred.succeed(app.server, existing.value)
        return existing.value
      }
      const routes = yield* Effect.serviceOption(Route.Routes)
      if (Option.isSome(routes)) {
        const server = yield* make(options ?? {}, routes.value)
        yield* Deferred.succeed(app.server, server)
        return server
      }
      const server = yield* make(options ?? {})
      yield* Deferred.succeed(app.server, server)
      return server
    }),
  )

export const withLogAddress = <A, E, R>(layer: Layer.Layer<A, E, R>) =>
  Layer.effectDiscard(
    Effect.gen(function* () {
      const { server } = yield* BunServer
      const { hostname, port } = server
      const addr = hostname === "0.0.0.0" ? getLocalIp() : "localhost"

      yield* Effect.log(`Listening on http://${addr}:${port}`)
    }),
  ).pipe(Layer.provideMerge(layer))

function walkBunRoutes(runtime: Runtime.Runtime<BunServer>, tree: RouteTree.RouteTree) {
  return Effect.gen(function* () {
    const bunRoutes: BunRoute.BunRoutes = {}
    const pathGroups = new Map<string, Array<RouteMount.MountedRoute>>()
    const toWebHandler = RouteHttp.toWebHandlerRuntime(runtime)

    let hasPrebuiltBundles = false

    for (const route of RouteTree.walk(tree)) {
      const bunDescriptors = BunRoute.descriptors(route)
      if (bunDescriptors) {
        const htmlBundle = yield* Effect.promise(bunDescriptors.bunLoad)
        if (htmlBundle.files) {
          hasPrebuiltBundles = true
          registerPrebuiltBundle(bunDescriptors.bunPrefix, htmlBundle, bunRoutes)
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

function registerPrebuiltBundle(prefix: string, bundle: any, bunRoutes: BunRoute.BunRoutes) {
  const mainDir = NPath.dirname(Bun.main)
  const indexPath = NPath.resolve(mainDir, bundle.index)

  const htmlPromise = rewriteRelativeAssetPaths(Bun.file(indexPath).text())

  bunRoutes[`${prefix}/*`] = async () =>
    new Response(await htmlPromise, { headers: { "content-type": "text/html;charset=utf-8" } })

  for (const file of bundle.files ?? []) {
    if (file.loader === "html") continue
    const absPath = NPath.resolve(mainDir, file.path)
    const basename = NPath.basename(file.path)
    bunRoutes[`/${basename}`] = () =>
      new Response(Bun.file(absPath), { headers: file.headers ?? {} })
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
  for (const entry of new Bun.Glob("*").scanSync({ cwd: dir, onlyFiles: true })) {
    const ext = NPath.extname(entry).toLowerCase()
    outputs.push({
      path: NPath.resolve(dir, entry),
      loader: loaderByExt[ext] ?? "file",
      kind: "asset",
    })
  }
  return outputs
}

function rewriteRelativeAssetPaths(html: string | Promise<string>): Promise<string> {
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
  return Object.values(NOs.networkInterfaces())
    .flatMap((addresses) => addresses ?? [])
    .find((addr) => addr.family === "IPv4" && !addr.internal)?.address
}
