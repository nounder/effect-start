import * as Effect from "effect/Effect"
import type * as Scope from "effect/Scope"
import type * as Utils from "effect/Utils"
import * as BunServer from "./bun/BunServer.ts"
import * as Entity from "./Entity.ts"
import type * as Values from "./internal/Values.ts"
import * as Route from "./Route.ts"
import * as Socket from "./Socket.ts"

export function ws<
  D,
  B,
  I extends Route.Route.Tuple,
  E = never,
  R = never,
>(
  handler: (
    context: Values.Simplify<
      & D
      & B
      & Route.ExtractBindings<I>
      & { protocol: "ws"; socket: Socket.Socket }
    >,
  ) =>
    | Effect.Effect<void, E, R | Scope.Scope>
    | Generator<
      Utils.YieldWrap<Effect.Effect<unknown, E, R | Scope.Scope>>,
      void,
      unknown
    >,
) {
  // The handler signature exposes `Scope.Scope` so authors can use scoped
  // operators (acquireRelease, addFinalizer). The handler runs under
  // Effect.scoped at runtime, so Scope is provided there and must NOT leak into
  // the route's requirements. Excluding it keeps `Route.layer`'s R clean.
  type RouteR = Exclude<R, Scope.Scope> | BunServer.BunServer
  return function(
    self: Route.RouteSet<D, B, I>,
  ): Route.RouteSet<
    D,
    B,
    [...I, Route.Route<{ protocol: "ws" }, {}, void, E, RouteR>]
  > {
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
      RouteR
    >(
      (context) =>
        Effect.gen(function*() {
          const server = yield* BunServer.BunServer
          const request = yield* Route.Request
          const socket = yield* server.upgrade(request)

          yield* Effect.forkDaemon(
            Effect.scoped(handle({ ...context, socket })).pipe(
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
        }).pipe(
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
          RouteR
        >,
      { protocol: "ws" },
    )

    return Route.set<
      D,
      B,
      [
        ...I,
        Route.Route<{ protocol: "ws" }, {}, void, E, RouteR>,
      ]
    >(
      [...Route.items(self), route] as [
        ...I,
        Route.Route<{ protocol: "ws" }, {}, void, E, RouteR>,
      ],
      Route.descriptor(self),
    )
  }
}
