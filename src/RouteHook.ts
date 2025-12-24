import * as Effect from "effect/Effect"
import * as Route from "./Route.ts"

export function filter<
  B extends Record<string, any>,
  E = never,
  R = never,
>(
  filterHandler: (
    context: any,
  ) => Effect.Effect<{ context: B }, E, R>,
) {
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
        const filterResult = yield* filterHandler(context)

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
    )
  }
}
