import * as Context from "effect/Context"
import * as Data from "effect/Data"
import * as Effect from "effect/Effect"
import * as Function from "effect/Function"
import * as Layer from "effect/Layer"
import * as Option from "effect/Option"
import * as Runtime from "effect/Runtime"
import * as Scope from "effect/Scope"
import * as BunRuntime from "./bun/BunRuntime.ts"
import * as BunServer from "./bun/BunServer.ts"
import * as BundleRoute from "./bundler/BundleRoute.ts"
import type * as ChildProcess from "./ChildProcess.ts"
import * as Development from "./Development.ts"
import type * as FileSystem from "./FileSystem.ts"
import * as LayerExtra from "./internal/LayerExtra.ts"
import * as PathPattern from "./internal/PathPattern.ts"
import * as RouteMap from "./internal/RouteMap.ts"
import * as Route from "./Route.ts"
import * as RouteHttp from "./RouteHttp.ts"

/**
 * Builds layers in the given order, wiring their dependencies automatically.
 *
 * Equivalent to chaining `Layer.provide` calls, but more concise.
 *
 * **Ordering: dependents first, dependencies last.**
 *
 * @example
 * ```ts
 * // UserRepo needs Database, Database needs Logger
 * const AppLayer = Start.build(
 *   UserRepoLive,   // needs Database, Logger
 *   DatabaseLive,   // needs Logger
 *   LoggerLive,     // no deps
 * )
 * // Result: Layer<UserRepo | Database | Logger, never, never>
 * ```
 *
 * @since 1.0.0
 * @category constructors
 */
export function build<
  const Layers extends readonly [Layer.Layer.Any, ...Array<Layer.Layer.Any>],
>(
  ...layers: Layers & LayerExtra.Ordered<NoInfer<Layers>, NoInfer<Layers>>
): Layer.Layer<
  LayerExtra.LayersSuccess<Layers>,
  LayerExtra.LayersError<Layers>,
  LayerExtra.LayersContext<Layers>
> {
  return (LayerExtra.provideMergeAll as (...l: Array<Layer.Layer.Any>) => any)(
    ...layers,
  )
}

/**
 * Like `build`, but accepts layers in any order. Every layer's dependencies
 * must be satisfied by another layer.
 *
 * @example
 * ```ts
 * // These all produce the same result:
 * Start.pack(LoggerLive, DatabaseLive, UserRepoLive)
 * Start.pack(UserRepoLive, DatabaseLive, LoggerLive)
 * ```
 */
export function pack<
  const Layers extends readonly [
    Layer.Layer.Any,
    ...Array<Layer.Layer.Any>,
  ],
>(
  ...layers: LayerExtra.Unordered<Layers>
): Layer.Layer<
  LayerExtra.LayersSuccess<Layers>,
  LayerExtra.LayersError<Layers>,
  never
> {
  return Layer.scopedContext(
    LayerExtra.buildUnordered(layers as unknown as Layers),
  ) as any
}

export function layerDev() {
  return Development.layerBase()
}

// TODO: do we even need to define requirements upfront?
type AppRequirements =
  | BunServer.BunServer
  | FileSystem.FileSystem
  | ChildProcess.ChildProcessSpawner

class StartError extends Data.TaggedError("StartError")<{
  readonly cause: unknown
}> {}

export function serve<ROut, E, RIn extends AppRequirements>(
  app:
    | Layer.Layer<ROut, E, RIn>
    | (() => Promise<{ default: Layer.Layer<ROut, E, RIn> }>),
) {
  const appLayer = typeof app === "function"
    ? Function.pipe(
      Effect.tryPromise({
        try: app,
        catch: (cause) => new StartError({ cause }),
      }),
      Effect.map((v) => v.default),
      Effect.orDie,
      Layer.unwrapEffect,
    )
    : app

  const appLayerResolved = Function.pipe(
    appLayer,
    Layer.provideMerge(layerDev()),
  )

  const composed = Function.pipe(
    BunServer.layerStart(),
    BunServer.withLogAddress,
    Layer.provide(
      Function.pipe(
        BundleRoute.layer(),
        Layer.provideMerge(appLayerResolved),
      ),
    ),
  ) as Layer.Layer<BunServer.BunServer, never, never>

  return Function.pipe(
    composed,
    Layer.launch,
    BunRuntime.runMain,
  )
}

/**
 * Given module meta of an entrypoint that exports Start app, run it.
 *
 * @example
 * ```ts
 * // server.ts or other entrypoint
 * import { Start } from "effect-start"
 *
 * export default Start.pack(...)
 *
 * Start.runMain(import.meta)
 * ```
 */
export function runMain(meta: ImportMeta): void {
  if (meta.main) {
    serve(() => import(meta.url))
  } else {
    // eslint-disable-next-line no-console
    console.warn(
      `Start.runMain: ${meta.url} is not an entrypoint, skipping.`,
    )
  }
}

export type FetchHandler = (
  request: Request,
  ...args: ReadonlyArray<unknown>
) => Promise<Response>

/**
 * Lets a layer turn the extra arguments a platform passes to `fetch` (e.g.
 * Cloudflare Workers' `env` and `ctx`) into request-scoped context that
 * route handlers can pull services from.
 */
export interface FetchAdapter {
  readonly context: (args: ReadonlyArray<unknown>) => Context.Context<never>
}

export const FetchAdapter = Context.GenericTag<FetchAdapter>(
  "effect-start/Start/FetchAdapter",
)

/**
 * Builds a `FetchAdapter` layer from a function mapping the extra arguments
 * passed to the exported `fetch` into a `Context` of services.
 *
 * @example
 * ```ts
 * // Cloudflare Workers call fetch(request, env, ctx)
 * class CloudflareEnv extends Context.Tag("CloudflareEnv")<CloudflareEnv, Env>() {}
 *
 * Start.layerFetchAdapter((env: Env) => Context.make(CloudflareEnv, env))
 * ```
 */
export function layerFetchAdapter(
  toContext: (...args: ReadonlyArray<any>) => Context.Context<never>,
): Layer.Layer<FetchAdapter> {
  return Layer.succeed(FetchAdapter, {
    context: (args) => toContext(...args),
  })
}

function dispatcher(
  routeMap: RouteMap.RouteMap,
  runtime: Runtime.Runtime<any>,
): (request: Request) => Promise<Response> {
  const handlers = Array.from(RouteHttp.walkHandles(routeMap, runtime))
  return (request) => {
    const pathname = decodeURI(new URL(request.url).pathname)
    for (const [path, handler] of handlers) {
      if (PathPattern.match(path, pathname) !== null) {
        return handler(request) as Promise<Response>
      }
    }
    return Promise.resolve(new Response("not found", { status: 404 }))
  }
}

/**
 * Like `pack`, but instead of starting a server, resolves to a `fetch`
 * handler — the shape serverless platforms (Cloudflare Workers, Deno Deploy)
 * expect.
 *
 * Unlike `serve`, this does not depend on `BunServer`, `BunRuntime`, or
 * `layerDev` (which pulls in Bun/Node-only services), so the resulting
 * `fetch` handler stays usable outside of Bun. Layers passed in must
 * satisfy their own dependencies, same as `pack`.
 *
 * A layer can provide `FetchAdapter` to accept extra arguments (beyond
 * `request`) and turn them into request-scoped context.
 *
 * @example
 * ```ts
 * export default { fetch: await Start.export(Route.layer(routes)) }
 * ```
 */
export function export_<
  const Layers extends readonly [Layer.Layer.Any, ...Array<Layer.Layer.Any>],
>(
  ...layers: LayerExtra.Unordered<Layers>
): Promise<FetchHandler> {
  const appLayer = Layer.scopedContext(
    LayerExtra.buildUnordered(layers as unknown as Layers),
  ) as Layer.Layer<
    LayerExtra.LayersSuccess<Layers>,
    LayerExtra.LayersError<Layers>,
    never
  >

  const composed = Function.pipe(
    BundleRoute.layer(),
    Layer.provideMerge(appLayer),
  )

  return Effect.runPromise(
    Effect.gen(function*() {
      const scope = yield* Scope.make()
      const runtime = yield* Layer.toRuntime(composed).pipe(
        Effect.provideService(Scope.Scope, scope),
      )
      const routeMap = Context.getOption(runtime.context, Route.Routes).pipe(
        Option.getOrElse(() => RouteMap.make({})),
      )
      const dispatch = dispatcher(routeMap, runtime)
      const adapter = Context.getOption(runtime.context, FetchAdapter)

      if (Option.isNone(adapter)) {
        return dispatch as FetchHandler
      }

      return ((request: Request, ...args: ReadonlyArray<unknown>) => {
        const requestRuntime = Runtime.updateContext(
          runtime,
          (ctx) => Context.merge(ctx, adapter.value.context(args)),
        )
        return dispatcher(routeMap, requestRuntime)(request)
      }) as FetchHandler
    }),
  )
}

export {
  export_ as export,
}
