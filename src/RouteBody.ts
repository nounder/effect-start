import * as Effect from "effect/Effect"
import * as Route from "./Route.ts"
import * as Values from "./Values.ts"

export const text = build<string>()({
  format: "text",
})

export const html = build<string>()({
  format: "html",
})

export const json = build<Values.Json>()({
  format: "json",
})

export const bytes = build<Uint8Array>()({
  format: "bytes",
})

function build<Value>() {
  return function<Format extends string>(
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
    >(
      handler: (
        context:
          & Route.ExtractContext<
            Priors,
            D
          >
          & {
            format: Format
          },
      ) => Effect.Effect<A, E, R>,
    ) {
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
}
