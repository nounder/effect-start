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
  options: Format<F>,
) {
  return function<
    A extends Value,
    E = never,
    R = never,
  >(
    handler: Route.Route.Handler<
      Format<F>,
      A,
      E,
      R
    >,
  ) {
    return function<
      D extends Route.RouteDescriptor.Any,
      Priors extends Route.RouteSet.Tuple,
    >(
      self: Route.RouteSet.RouteSet<D, Priors>,
    ) {
      const route = Route.make<
        Format<F>,
        Route.ExtractBindings<Priors>,
        A,
        E,
        R
      >(
        handler as Route.Route.Handler<
          & Route.ExtractBindings<Priors>
          & Format<F>,
          A,
          E,
          R
        >,
        options,
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
