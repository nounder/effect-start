import * as Effect from "effect/Effect"
import * as Route from "./Route.ts"
import * as Values from "./Values.ts"

export const text = build<string, "text">({
  format: "text",
})

export const html = build<string, "html">({
  format: "html",
})

export const json = build<Values.Json, "json">({
  format: "json",
})

export const bytes = build<Uint8Array, "bytes">({
  format: "bytes",
})

type Format<V extends string> = {
  format: V
}

function build<
  Value,
  F extends string,
>(
  descriptors: Format<F>,
) {
  return function<
    D extends Route.RouteDescriptor.Any,
    Priors extends Route.RouteSet.Tuple,
    A extends Value,
    E = never,
    R = never,
    B = D & Route.ExtractBindings<Priors> & Format<F>,
  >(
    handler: Route.Route.HandlerImmutable<B, A, E, R>,
  ) {
    return function(
      self: Route.RouteSet.RouteSet<D, Priors>,
    ) {
      const route = Route.make(
        handler as any,
        descriptors,
      )

      return Route.set(
        [
          ...Route.items(self),
          route,
        ] as const,
      )
    }
  }
}
