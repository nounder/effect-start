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

function build<Value, Format extends string>(
  options: {
    format: Format
  },
) {
  return function<
    A extends Value,
    E,
    R,
    D extends Route.RouteDescriptor.Any,
    Priors extends Route.RouteSet.Tuple,
    B =
      & Route.ExtractContext<
        Priors,
        D
      >
      & {
        format: Format
      },
  >(
    handler:
  ) {
        context:
          & Route.ExtractContext<
            Priors,
            D
          >
          & {
            format: Format
          },
      ) => Effect.Effect<A, E, R>,
    return function(
      self: Route.RouteSet.RouteSet<D, Priors>,
    ) {
      const route = Route.make<
        {
          format: Format
        },
        Route.ExtractBindings<Priors>,
        A,
        E,
        R
      >(
        handler as Route.Route.Handler<
          & Route.ExtractBindings<Priors>
          & { format: Format },
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
