import * as Effect from "effect/Effect"
import * as Exit from "effect/Exit"
import * as Scope from "effect/Scope"
import type * as Utils from "effect/Utils"
import * as BunServer from "./bun/BunServer.ts"
import * as Entity from "./Entity.ts"
import type * as Values from "./internal/Values.ts"
import * as Route from "./Route.ts"
import * as Socket from "./Socket.ts"

type YieldError<T> = T extends Utils.YieldWrap<Effect.Effect<any, infer E, any>> ? E
  : never
type YieldContext<T> = T extends Utils.YieldWrap<Effect.Effect<any, any, infer R>> ? R
  : never

type WsContext<D, B, I extends Route.Route.Tuple> = Values.Simplify<
  & D
  & B
  & Route.ExtractBindings<I>
  & { protocol: "ws"; socket: Socket.Socket }
>

// The handler runs under its own Scope at runtime (so authors can use
// acquireRelease/addFinalizer), and BunServer is provided by the request
// runtime. Strip Scope from the handler's R and add BunServer so neither leaks
// into `Route.layer`'s requirements as something the app must provide.
type WsRouteR<R> = Exclude<R, Scope.Scope> | BunServer.BunServer

type WsRoute<I extends Route.Route.Tuple, E, R> = [
  ...I,
  Route.Route<{ protocol: "ws" }, {}, void, E, WsRouteR<R>>,
]

export function ws<
  D,
  B,
  I extends Route.Route.Tuple,
  Y extends Utils.YieldWrap<Effect.Effect<any, any, any>>,
>(
  handler: (
    context: WsContext<D, B, I>,
  ) => Generator<Y, void, unknown>,
): (
  self: Route.RouteSet<D, B, I>,
) => Route.RouteSet<D, B, WsRoute<I, YieldError<Y>, YieldContext<Y>>>
export function ws<
  D,
  B,
  I extends Route.Route.Tuple,
  E = never,
  R = never,
>(
  handler: (
    context: WsContext<D, B, I>,
  ) => Effect.Effect<void, E, R | Scope.Scope>,
): (
  self: Route.RouteSet<D, B, I>,
) => Route.RouteSet<D, B, WsRoute<I, E, R>>
export function ws<
  D,
  B,
  I extends Route.Route.Tuple,
  E = never,
  R = never,
>(
  handler: (
    context: WsContext<D, B, I>,
  ) =>
    | Effect.Effect<void, E, R | Scope.Scope>
    | Generator<
      Utils.YieldWrap<Effect.Effect<unknown, E, R | Scope.Scope>>,
      void,
      unknown
    >,
) {
  return function(
    self: Route.RouteSet<D, B, I>,
  ): Route.RouteSet<D, B, WsRoute<I, E, R>> {
    const handle = (context: any): Effect.Effect<void, E, R | Scope.Scope> => {
      const result = handler(context)
      const effect = Effect.isEffect(result)
        ? result
        : Effect.gen(function*() {
          return yield* result
        })
      return effect as Effect.Effect<void, E, R | Scope.Scope>
    }

    const route = Route.make<
      { protocol: "ws" },
      {},
      void,
      E,
      WsRouteR<R>
    >(
      (context) =>
        Effect
          .gen(function*() {
            const server = yield* BunServer.BunServer
            const request = yield* Route.Request

            // scope is shared with handler and the connection.
            // finalizer makes sure the socket is closed.
            const handlerScope = yield* Scope.make()
            const socket = yield* server.upgrade(request, handlerScope).pipe(
              Effect.onError(() => Scope.close(handlerScope, Exit.void)),
            )

            yield* server.runFork(
              Scope.use(handle({ ...context, socket }), handlerScope).pipe(
                Effect.catchIf(
                  Socket.SocketCloseError.isClean((code) => code === 1000 || code === 1006),
                  () => Effect.void,
                ),
                Effect.catchAllCause((cause) => Effect.logError(cause)),
              ),
            )

            // After a successful upgrade Bun hijacks the connection and ignores
            // the response returned from the fetch handler. The chain still
            // serializes this entity, so use an empty body and a status the
            // Response constructor accepts.
            return Entity.make("", { status: 200 })
          })
          .pipe(
            Effect.catchIf(
              (error) => error.reason._tag === "SocketOpenError",
              () =>
                Effect.succeed(
                  Entity.make("", {
                    status: 426,
                    headers: { upgrade: "websocket" },
                  }),
                ),
            ),
          ) as unknown as Effect.Effect<
            Entity.Entity<void>,
            E,
            WsRouteR<R>
          >,
      { protocol: "ws" },
    )

    return Route.set<D, B, WsRoute<I, E, R>>(
      [...Route.items(self), route] as WsRoute<I, E, R>,
      Route.descriptor(self),
    )
  }
}
