import * as Effect from "effect/Effect"
import type * as Utils from "effect/Utils"
import type * as Entity from "./Entity.ts"
import * as Route from "./Route.ts"

type FilterResult<BOut, E, R> =
  | { context: BOut }
  | Effect.Effect<{ context: BOut }, E, R>

type FilterHandlerInput<BIn, BOut, E, R> =
  | FilterResult<BOut, E, R>
  | ((
    context: BIn,
  ) =>
    | FilterResult<BOut, E, R>
    | Generator<
      Utils.YieldWrap<Effect.Effect<unknown, E, R>>,
      { context: BOut },
      unknown
    >)

export function filter<
  D,
  SB,
  P extends Route.Route.Tuple,
  BOut extends Record<string, unknown>,
  E = never,
  R = never,
  BIn = D & SB & Route.ExtractBindings<P>,
>(filterHandler: FilterHandlerInput<BIn, BOut, E, R>) {
  const normalized = normalizeFilterHandler(filterHandler)

  return function(
    self: Route.RouteSet<D, SB, P>,
  ): Route.RouteSet<D, SB, [...P, Route.Route<{}, BOut, unknown, E, R>]> {
    const route = Route.make<{}, BOut, unknown, E, R>(
      (context: BOut, next: Entity.Entity<unknown, never>) =>
        Effect.gen(function*() {
          const filterResult = yield* normalized(context as unknown as BIn)
          if (!filterResult) return yield* next
          const ref = yield* Route.RouteContext
          ref.context = { ...context, ...filterResult.context }
          return yield* next
        }),
    )

    return Route.set(
      [...Route.items(self), route] as [
        ...P,
        Route.Route<{}, BOut, unknown, E, R>,
      ],
      Route.descriptor(self),
    )
  }
}

function isGenerator(value: unknown): value is Generator {
  return (
    typeof value === "object" &&
    value !== null &&
    Symbol.iterator in value &&
    typeof (value as Generator).next === "function"
  )
}

function normalizeFilterHandler<BIn, BOut, E, R>(
  handler: FilterHandlerInput<BIn, BOut, E, R>,
): (context: BIn) => Effect.Effect<{ context: BOut }, E, R> {
  if (typeof handler === "function") {
    return (context: BIn): Effect.Effect<{ context: BOut }, E, R> => {
      const result = handler(context)

      if (Effect.isEffect(result)) {
        return result as Effect.Effect<{ context: BOut }, E, R>
      }

      if (isGenerator(result)) {
        return Effect.gen(function*() {
          return yield* result
        }) as Effect.Effect<{ context: BOut }, E, R>
      }

      return Effect.succeed(result)
    }
  }

  if (Effect.isEffect(handler)) {
    return (_context) => handler as Effect.Effect<{ context: BOut }, E, R>
  }

  return (_context) => Effect.succeed(handler as { context: BOut })
}
