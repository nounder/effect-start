import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Fiber from "effect/Fiber"
import * as HttpServerRequest from "effect/http/HttpServerRequest"
import type * as Scope from "effect/Scope"
import * as Socket from "effect/socket/Socket"
import * as Entity from "../Entity.ts"
import * as Route from "../Route.ts"
import type * as Values from "./Values.ts"

export const HandlerScope = Context.Reference<Scope.Scope | undefined>(
  "effect-start/RouteSocket/HandlerScope",
  { defaultValue: () => undefined },
)

type YieldError<T> = T extends Effect.Effect<any, infer E, any> ? E
  : never
type YieldContext<T> = T extends Effect.Effect<any, any, infer R> ? R
  : never

type WsContext<D, B, I extends Route.Route.Tuple> = Values.Simplify<
  & D
  & B
  & Route.ExtractBindings<I>
  & { protocol: "ws"; socket: Socket.Socket }
>

type WsRouteR<R> = Exclude<R, Scope.Scope> | HttpServerRequest.HttpServerRequest

type WsRoute<I extends Route.Route.Tuple, E, R> = [
  ...I,
  Route.Route<{ protocol: "ws" }, {}, void, E, WsRouteR<R>>,
]

export function ws<
  D,
  B,
  I extends Route.Route.Tuple,
  Y extends Effect.Effect<any, any, any>,
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
      Effect.Effect<unknown, E, R | Scope.Scope>,
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
            const request = yield* HttpServerRequest.HttpServerRequest
            const socket = yield* request.upgrade
            const handlerScope = yield* HandlerScope
            const handlerEffect = handle({ ...context, socket }).pipe(
              Effect.catchIf(
                (error) =>
                  Socket.isSocketError(error) && error.reason._tag === "SocketCloseError" && [1000, 1001, 1005, 1006]
                    .includes(error.reason.code),
                () => Effect.void,
              ),
              Effect.catchCause((cause) => Effect.logError(cause)),
            )
            yield* handlerScope === undefined
              ? handlerEffect
              : Effect.forkIn(handlerEffect, handlerScope).pipe(
                Effect.flatMap(Fiber.join),
              )

            return Entity.make("", { status: 200 })
          })
          .pipe(
            Effect.catch((_) =>
              Effect.succeed(
                Entity.make("", {
                  status: 426,
                  headers: { upgrade: "websocket" },
                }),
              )
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
