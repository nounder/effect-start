import * as Effect from "effect/Effect"
import * as Entity from "../Entity.ts"
import * as Route from "../Route.ts"
import type * as RouteBody from "../RouteBody.ts"
import type * as Values from "../Values.ts"
import * as HyperHtml from "./HyperHtml.ts"
import type { JSX } from "./jsx.d.ts"

function renderValue(
  value: JSX.Children | Entity.Entity<JSX.Children>,
): string | Entity.Entity<string> {
  if (Entity.isEntity(value)) {
    return Entity.make(HyperHtml.renderToString(value.body), {
      status: value.status,
      url: value.url,
      headers: value.headers,
    })
  }
  return HyperHtml.renderToString(value)
}

function normalizeToEffect<B, A, E, R>(
  handler: RouteBody.HandlerInput<B, A, E, R>,
  context: Values.Simplify<B>,
  next: (context?: Partial<B> & Record<string, unknown>) => Entity.Entity<A>,
): Effect.Effect<A | Entity.Entity<A>, E, R> {
  if (Effect.isEffect(handler)) {
    return handler
  }
  if (typeof handler === "function") {
    const result = (handler as Function)(context, next)
    if (Effect.isEffect(result)) {
      return result as Effect.Effect<A | Entity.Entity<A>, E, R>
    }
    return Effect.gen(function* () {
      return yield* result
    }) as Effect.Effect<A | Entity.Entity<A>, E, R>
  }
  return Effect.succeed(handler as A | Entity.Entity<A>)
}

export function html<
  D extends Route.RouteDescriptor.Any,
  B extends {},
  I extends Route.Route.Tuple,
  E = never,
  R = never,
>(
  handler: RouteBody.HandlerInput<
    NoInfer<D & B & Route.ExtractBindings<I> & { format: "html" }>,
    JSX.Children,
    E,
    R
  >,
) {
  return Route.html<D, B, I, string, E, R>((context, next) =>
    Effect.map(normalizeToEffect(handler, context, next as never), renderValue),
  )
}
