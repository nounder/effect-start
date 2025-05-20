import { type HttpApp, HttpRouter, HttpServer } from "@effect/platform"
import { BunContext, BunHttpServer, BunRuntime } from "@effect/platform-bun"
import type { RouteNotFound } from "@effect/platform/HttpServerError"
import { Layer, pipe } from "effect"
import type { ClientKey } from "../Bundle.ts"
import { BunBundle } from "../index.ts"

export function serve(opts: {
  server: HttpApp.Default<RouteNotFound, ClientKey>
  port?: 3000
  client?: ReturnType<typeof BunBundle.bundleClient>
}) {
  return pipe(
    HttpServer.serve(opts.server),
    HttpServer.withLogAddress,
    Layer.provide([
      BunHttpServer.layer({
        port: opts.port ?? 3000,
      }),
      opts.client?.layer ?? Layer.empty as Layer.Layer<ClientKey>,
      BunContext.layer,
    ]),
    Layer.launch,
    BunRuntime.runMain,
  )
}

export function serveRouter(
  router: HttpRouter.HttpRouter<RouteNotFound, ClientKey>,
  opts?: {
    clientConfig: BunBundle.BunBuildOptions
    port?: 3000
  },
) {
  const clientRouterConfig = BunBundle.configFromHttpRouter(router)
  const clientConfig = {
    ...clientRouterConfig,
    ...(opts?.clientConfig || {}),
  }
  const bundle = BunBundle.bundleClient(clientConfig)

  return serve({
    server: router,
    port: opts?.port,
    client: bundle,
  })
}
