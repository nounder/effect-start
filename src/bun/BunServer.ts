import * as Config from "effect/Config"
import type * as Context from "effect/Context"
import type * as Duration from "effect/Duration"
import * as Effect from "effect/Effect"
import * as Exit from "effect/Exit"
import * as Layer from "effect/Layer"
import * as Option from "effect/Option"
import * as Scope from "effect/Scope"
import * as HttpMiddleware from "effect/unstable/http/HttpMiddleware"
import * as HttpServer from "effect/unstable/http/HttpServer"
import * as HttpServerRequest from "effect/unstable/http/HttpServerRequest"
import * as HttpServerResponse from "effect/unstable/http/HttpServerResponse"
import * as NOs from "node:os"
import * as NPath from "node:path"
import * as PathPattern from "../internal/PathPattern.ts"
import * as RouteMap from "../internal/RouteMap.ts"
import type * as RouteMount from "../internal/RouteMount.ts"
import * as RouteSocket from "../internal/RouteSocket.ts"
import * as Route from "../Route.ts"
import * as RouteHttp from "../RouteHttp.ts"
import * as BunRoute from "./BunRoute.ts"
import * as AgentHarness from "./internal/AgentHarness.ts"
import * as BunHttpServer from "./internal/BunHttpServer.ts"
import * as MainFiber from "./internal/MainFiber.ts"

export type BunServeOptions = BunHttpServer.ServeOptions & {
  readonly disablePreemptiveShutdown?: boolean
  readonly gracefulShutdownTimeout?: Duration.Input
  readonly websocket?: BunHttpServer.WebSocketOptions
}

const optionsWithDefaults = (options: BunServeOptions) =>
  "unix" in options && options.unix !== undefined
    ? Effect.succeed(options)
    : Effect.gen(function*() {
      const port = yield* Config.number("PORT").pipe(
        Effect.catchTag("ConfigError", () => Effect.succeed(AgentHarness.isAgentHarness() ? 0 : 3000)),
      )
      const hostname = yield* Config.string("HOST").pipe(
        Effect.catchTag("ConfigError", () => Effect.succeed(process.argv.includes("--host") ? "0.0.0.0" : undefined)),
      )
      return { port, hostname, ...options } satisfies BunServeOptions
    })

const routeGroups = (map: RouteMap.RouteMap) => {
  const groups = new Map<string, Array<RouteMount.MountedRoute>>()
  for (const route of RouteMap.walk(map)) {
    const path = Route.descriptor<{ path: string }>(route).path
    const group = groups.get(path) ?? []
    group.push(route)
    groups.set(path, group)
  }
  return groups
}

const routeApp = (map: RouteMap.RouteMap, handlerScope: Scope.Scope) => {
  const groups = routeGroups(map)
  return HttpServerRequest.HttpServerRequest.use((request) => {
    const pathname = decodeURI(new URL(request.url, "http://localhost").pathname)
    for (const [path, routes] of groups) {
      if (PathPattern.match(path, pathname) !== null) {
        return RouteHttp.tracedHandler<never>(routes).pipe(
          Effect.provideService(RouteSocket.HandlerScope, handlerScope),
        )
      }
    }
    return Effect.succeed(HttpServerResponse.text("not found", { status: 404 }))
  })
}

const registerPrebuiltBundle = (
  prefix: string,
  bundle: Bun.HTMLBundle,
  bunRoutes: BunRoute.BunRoutes,
): void => {
  const mainDir = NPath.dirname(Bun.main)
  const indexPath = NPath.resolve(mainDir, bundle.index)
  const htmlPromise = rewriteRelativeAssetPaths(Bun.file(indexPath).text())

  bunRoutes[`${prefix}/*`] = async () =>
    new Response(await htmlPromise, {
      headers: { "content-type": "text/html;charset=utf-8" },
    })

  for (const file of bundle.files ?? []) {
    if (file.loader === "html") continue
    const path = NPath.resolve(mainDir, file.path)
    bunRoutes[`/${NPath.basename(file.path)}`] = () => new Response(Bun.file(path), { headers: file.headers ?? {} })
  }
}

const discoverStaticOutputs = (dir: string): Array<Pick<Bun.BuildArtifact, "path" | "loader" | "kind">> => {
  const loaderByExtension: Record<string, Bun.Loader> = {
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
  const outputs: Array<Pick<Bun.BuildArtifact, "path" | "loader" | "kind">> = []
  for (const entry of new Bun.Glob("*").scanSync({ cwd: dir, onlyFiles: true })) {
    outputs.push({
      path: NPath.resolve(dir, entry),
      loader: loaderByExtension[NPath.extname(entry).toLowerCase()] ?? "file",
      kind: "asset",
    })
  }
  return outputs
}

const rewriteRelativeAssetPaths = (html: string | Promise<string>): Promise<string> => {
  const rewriter = new HTMLRewriter()
    .on("link[href]", {
      element(element) {
        const href = element.getAttribute("href")
        if (href?.startsWith("./") || href?.startsWith("../")) {
          element.setAttribute("href", `/${NPath.basename(href)}`)
        }
      },
    })
    .on("script[src]", {
      element(element) {
        const src = element.getAttribute("src")
        if (src?.startsWith("./") || src?.startsWith("../")) {
          element.setAttribute("src", `/${NPath.basename(src)}`)
        }
      },
    })
    .on("img[src]", {
      element(element) {
        const src = element.getAttribute("src")
        if (src?.startsWith("./") || src?.startsWith("../")) {
          element.setAttribute("src", `/${NPath.basename(src)}`)
        }
      },
    })
  return Promise.resolve(html).then((value) => rewriter.transform(new Response(value)).text())
}

const compileBunRoutes = (
  map: RouteMap.RouteMap,
  context: Context.Context<never>,
) =>
  Effect.gen(function*() {
    const bunRoutes: BunRoute.BunRoutes = {}
    const groups = routeGroups(map)
    let hasPrebuiltBundles = false

    for (const route of RouteMap.walk(map)) {
      const descriptors = BunRoute.descriptors(route)
      if (descriptors === undefined) continue
      const bundle = yield* Effect.tryPromise({
        try: descriptors.bunLoad,
        catch: (cause) =>
          new BunRoute.BunRouteError({
            reason: "ProxyError",
            pattern: descriptors.bunPrefix,
            message: String(cause),
          }),
      })
      if (bundle.files) {
        hasPrebuiltBundles = true
        registerPrebuiltBundle(descriptors.bunPrefix, bundle, bunRoutes)
      } else {
        bunRoutes[`${descriptors.bunPrefix}/*`] = bundle
      }
    }

    for (const [path, routes] of groups) {
      if (routes.some((route) => Route.descriptor<{ protocol?: "ws" }>(route).protocol === "ws")) continue
      const handler = RouteHttp.toWebHandlerWith(context)(routes)
      for (const bunPath of PathPattern.toBun(path)) bunRoutes[bunPath] = handler
    }

    if (hasPrebuiltBundles) {
      for (const output of discoverStaticOutputs(NPath.dirname(Bun.main))) {
        const path = `/${NPath.basename(output.path)}`
        if (!(path in bunRoutes)) bunRoutes[path] = Bun.file(output.path)
      }
    }

    return bunRoutes
  })

const makeServer = (
  options: BunServeOptions = {},
  map?: RouteMap.RouteMap,
) =>
  Effect.gen(function*() {
    const context = yield* Effect.context<never>()
    const configured = yield* optionsWithDefaults(options)
    const routes = map === undefined ? undefined : yield* compileBunRoutes(map, context)
    const managed = yield* BunHttpServer.make({
      ...configured,
      ...(routes === undefined
        ? undefined
        : { routes: { ...configured.routes, ...routes } }),
    })
    controllers.set(managed.service, managed)
    return managed.service
  })

const controllers = new WeakMap<
  HttpServer.HttpServer["Service"],
  BunHttpServer.ManagedServer
>()

export const make = (options: BunServeOptions = {}) => makeServer(options)

export const layer = (options: BunServeOptions = {}) =>
  Layer.merge(
    Layer.effect(HttpServer.HttpServer, makeServer(options)),
    BunHttpServer.layerHttpServices,
  )

const serveRoutes = (routes: RouteMap.RouteMap) =>
  Effect.gen(function*() {
    const generation = MainFiber.get()
    const context = yield* Effect.context<never>()
    const server = yield* HttpServer.HttpServer
    const managed = controllers.get(server)
    if (managed !== undefined) {
      managed.replaceRoutes(yield* compileBunRoutes(routes, context), generation)
    }
    const handlerScope = yield* Scope.make()
    yield* server.serve(routeApp(routes, handlerScope))
    yield* Effect.addFinalizer(() => Scope.close(handlerScope, Exit.void))
  })

export const layerRoutes = (options: BunServeOptions = {}) =>
  Layer.unwrap(Effect.map(Route.Routes, (routes) => {
    const serverLayer = Layer.merge(
      Layer.effect(HttpServer.HttpServer, makeServer(options, routes)),
      BunHttpServer.layerHttpServices,
    )
    const applicationLayer = Layer.effectDiscard(serveRoutes(routes)).pipe(
      Layer.provide(serverLayer),
      Layer.provide(Layer.succeed(HttpMiddleware.TracerDisabledWhen)(() => true)),
    )
    return Layer.merge(serverLayer, applicationLayer)
  }))

export const layerStart = (options: BunServeOptions = {}) =>
  Layer.unwrap(Effect.gen(function*() {
    const routes = yield* Route.Routes
    const existing = yield* Effect.serviceOption(HttpServer.HttpServer)
    const serverLayer = Option.isSome(existing)
      ? Layer.succeed(HttpServer.HttpServer, existing.value)
      : Layer.effect(HttpServer.HttpServer, makeServer(options, routes))
    const platformLayer = Option.isSome(existing)
      ? serverLayer
      : Layer.merge(serverLayer, BunHttpServer.layerHttpServices)
    const applicationLayer = Layer.effectDiscard(serveRoutes(routes)).pipe(
      Layer.provide(platformLayer),
      Layer.provide(Layer.succeed(HttpMiddleware.TracerDisabledWhen)(() => true)),
    )
    return Layer.merge(platformLayer, applicationLayer)
  }))

export const withLogAddress = <A, E, R>(serverLayer: Layer.Layer<A, E, R>) =>
  Layer
    .effectDiscard(HttpServer.HttpServer.use((server) => {
      if (server.address._tag === "UnixAddress") return Effect.log(`Listening on unix:${server.address.path}`)
      const host = server.address.hostname === "0.0.0.0" ? (getLocalIp() ?? "localhost") : "localhost"
      return Effect.log(`Listening on http://${host}:${server.address.port}`)
    }))
    .pipe(Layer.provideMerge(serverLayer))

function getLocalIp(): string | undefined {
  return Object
    .values(NOs.networkInterfaces())
    .flatMap((addresses) => addresses ?? [])
    .find((address) => address.family === "IPv4" && !address.internal)
    ?.address
}
