import * as Effect from "effect/Effect"
import type * as Utils from "effect/Utils"
import * as Route from "./Route.ts"

export type FilterResult<BOut, E, R> =
  | { context: BOut }
  | Effect.Effect<{ context: BOut }, E, R>

export type FilterHandlerInput<BIn, BOut, E, R> =
  | FilterResult<BOut, E, R>
  | ((context: BIn) =>
    | FilterResult<BOut, E, R>
    | Generator<
      Utils.YieldWrap<Effect.Effect<any, E, R>>,
      { context: BOut },
      any
    >)

export function filter<
  D extends Route.RouteDescriptor.Any,
  SB extends {},
  P extends Route.RouteSet.Tuple,
  BOut extends {},
  E = never,
  R = never,
  BIn = D & SB & Route.ExtractBindings<P>,
>(
  filterHandler: FilterHandlerInput<BIn, BOut, E, R>,
) {
  const normalized = normalizeFilterHandler(filterHandler)

  return function(
    self: Route.RouteSet.RouteSet<D, SB, P>,
  ): Route.RouteSet.RouteSet<
    D,
    SB,
    [...P, Route.Route.Route<{}, BOut, void, E, R>]
  > {
    const route = Route.make<
      {},
      BOut,
      void,
      E,
      R
    >((context: any, next) =>
      Effect.gen(function*() {
        const filterResult = yield* normalized(context)

        yield* next(
          filterResult
            ? {
              ...context,
              ...filterResult.context,
            }
            : context,
        )
      })
    )

    return Route.set(
      [
        ...Route.items(self),
        route,
      ] as [...P, Route.Route.Route<{}, BOut, void, E, R>],
      Route.descriptor(self),
    )
  }
}

function isGenerator(value: unknown): value is Generator {
  return (
    typeof value === "object"
    && value !== null
    && Symbol.iterator in value
    && typeof (value as Generator).next === "function"
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
