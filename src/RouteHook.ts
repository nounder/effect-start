import * as Effect from "effect/Effect"
import type * as Utils from "effect/Utils"
import * as Route from "./Route.ts"

export type FilterHandlerInput<B, E, R> =
  | { context: B }
  | Effect.Effect<{ context: B }, E, R>
  | ((context: any) =>
    | { context: B }
    | Effect.Effect<{ context: B }, E, R>
    | Generator<Utils.YieldWrap<Effect.Effect<any, E, R>>, { context: B }, any>)

export function filter<
  B extends Record<string, any>,
  E = never,
  R = never,
>(
  filterHandler: FilterHandlerInput<B, E, R>,
) {
  const normalized = normalizeFilterHandler(filterHandler)

  return function<
    D extends Route.RouteDescriptor.Any,
    P extends Route.RouteSet.Tuple,
  >(
    self: Route.RouteSet.RouteSet<D, {}, P>,
  ) {
    const route = Route.make<
      {},
      B & Route.ExtractBindings<P>,
      void,
      E,
      R
    >((context, next) =>
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
      ] as const,
      self[Route.RouteDescriptor],
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

function normalizeFilterHandler<B, E, R>(
  handler: FilterHandlerInput<B, E, R>,
): (context: any) => Effect.Effect<{ context: B }, E, R> {
  if (typeof handler === "function") {
    return (context: any): Effect.Effect<{ context: B }, E, R> => {
      const result = handler(context)

      if (Effect.isEffect(result)) {
        return result as Effect.Effect<{ context: B }, E, R>
      }

      if (isGenerator(result)) {
        return Effect.gen(function*() {
          return yield* result
        }) as Effect.Effect<{ context: B }, E, R>
      }

      return Effect.succeed(result)
    }
  }

  if (Effect.isEffect(handler)) {
    return (_context) => handler
  }

  return (_context) => Effect.succeed(handler as { context: B })
}
