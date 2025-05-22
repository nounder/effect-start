import { HttpApp, HttpRouter, HttpServer } from "@effect/platform"
import { BunContext, BunRuntime } from "@effect/platform-bun"
import { Effect, Layer, pipe } from "effect"
import type { ClientKey } from "../Bundle.ts"
import * as HttpAppExtra from "../HttpAppExtra.ts"
import type { BunBuildOptions } from "./BunBundle.ts"
import * as BunBundle from "./BunBundle.ts"
import * as BunFullStackServer from "./BunFullstackServer.ts"

/**
 * Starts a Bun server with client bundle if provided.
 */
export function serve(opts: {
  server: HttpApp.Default<any, ClientKey>
  port?: 3000
  client?: ReturnType<typeof BunBundle.bundleClient>
  routes?: any
}) {
  return pipe(
    HttpServer.serve(opts.server.pipe(
      Effect.catchAll(HttpAppExtra.renderError),
    )),
    HttpServer.withLogAddress,
    Layer.provide([
      BunFullStackServer.layer({
        port: opts.port ?? 3000,
        routes: opts.routes,
      }),
      opts.client?.layer ?? Layer.empty as Layer.Layer<ClientKey>,
      BunContext.layer,
    ]),
    Layer.launch,
    BunRuntime.runMain,
  )
}

/**
 * Starts a Bun server from a router that may contain client bundle
 * information via BundleHttp.
 */
export function serveRouter(
  router: HttpRouter.HttpRouter<any, ClientKey>,
  opts?: {
    clientConfig: BunBundle.BunBuildOptions
    port?: 3000
  },
) {
  const clientRouterConfig = BunBundle.configFromHttpRouter(router)
  const clientConfig: BunBuildOptions = {
    ...clientRouterConfig,
    ...(opts?.clientConfig || {}),
    entrypoints: [
      ...clientRouterConfig.entrypoints,
      ...(opts?.clientConfig?.entrypoints || []),
    ],
  }

  const bundle = BunBundle.bundleClient(clientConfig)

  return serve({
    server: router,
    port: opts?.port,
    client: bundle,
    routes: {},
  })
}
