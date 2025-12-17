import type * as HttpMethod from "@effect/platform/HttpMethod"
import * as Effect from "effect/Effect"
import type * as Utils from "effect/Utils"
import * as Route from "./Route.ts"
import * as RouteSet from "./RouteSet.ts"
import * as _schema from "./RouteSet_schema.ts"

type ExtractError<Eff> = [Eff] extends [never] ? never
  : [Eff] extends [Utils.YieldWrap<Effect.Effect<any, infer E, any>>] ? E
  : never

type ExtractContext<Eff> = [Eff] extends [never] ? never
  : [Eff] extends [Utils.YieldWrap<Effect.Effect<any, any, infer R>>] ? R
  : never

export type HandlerInput<A, E, R> =
  | A
  | Effect.Effect<A, E, R>
  | ((context: Route.RouteContext) =>
    | Effect.Effect<A, E, R>
    | Generator<Utils.YieldWrap<Effect.Effect<any, E, R>>, A, any>)

export function normalizeHandler<A, E, R>(
  handler: HandlerInput<A, E, R>,
): Route.RouteHandler<A, E, R> {
  if (typeof handler === "function") {
    const wrapper = (context: Route.RouteContext): Effect.Effect<A, E, R> => {
      const result = (handler as Function)(context)
      if (Effect.isEffect(result)) {
        return result as Effect.Effect<A, E, R>
      }
      return Effect.gen(() => result) as Effect.Effect<A, E, R>
    }
    return Object.assign(wrapper, handler)
  }
  if (Effect.isEffect(handler)) {
    return () => handler
  }
  return () => Effect.succeed(handler as A)
}

export function makeHandlerMaker<
  Method extends HttpMethod.HttpMethod,
  Media extends Route.RouteMedia,
  Value,
>(
  method: Method,
  media: Media,
) {
  type ResultType<
    S extends Route.Self,
    A,
    E,
    R,
  > = S extends RouteSet.RouteSet<infer Routes, infer Schemas>
    ? RouteSet.RouteSet<
      [
        ...Routes,
        Route.Route<Method, Media, Route.RouteHandler<A, E, R>, Schemas>,
      ],
      Schemas
    >
    : RouteSet.RouteSet<
      [
        Route.Route<
          Method,
          Media,
          Route.RouteHandler<A, E, R>,
          Route.RouteSchemas.Empty
        >,
      ],
      Route.RouteSchemas.Empty
    >

  type ContextType<S extends Route.Self> = S extends
    RouteSet.RouteSet<infer _Routes, infer Schemas>
    ? Route.RouteContext<_schema.DecodeRouteSchemas<Schemas>, Value>
    : Route.RouteContext<{}, Value>

  function make<S extends Route.Self, A extends Value>(
    this: S,
    handler: A,
  ): ResultType<S, A, never, never>
  function make<S extends Route.Self, A extends Value, E, R>(
    this: S,
    handler: Effect.Effect<A, E, R>,
  ): ResultType<S, A, E, R>
  function make<S extends Route.Self, A extends Value, E, R>(
    this: S,
    handler: (context: ContextType<S>) => Effect.Effect<A, E, R>,
  ): ResultType<S, A, E, R>
  function make<
    S extends Route.Self,
    A extends Value,
    Eff extends Utils.YieldWrap<Effect.Effect<any, any, any>>,
  >(
    this: S,
    handler: (context: ContextType<S>) => Generator<Eff, A, never>,
  ): ResultType<S, A, ExtractError<Eff>, ExtractContext<Eff>>

  function make(
    this: Route.Self,
    handler: unknown,
  ): RouteSet.RouteSet<readonly Route.Route.Default[], Route.RouteSchemas> {
    const baseRoutes = RouteSet.isRouteSet(this)
      ? RouteSet.items(this)
      : [] as const
    const baseSchema = RouteSet.isRouteSet(this)
      ? RouteSet.schemas(this)
      : {} as Route.RouteSchemas.Empty

    return RouteSet.make(
      [
        ...baseRoutes,
        Route.make({
          method,
          media,
          handler: normalizeHandler(
            handler as HandlerInput<unknown, unknown, unknown>,
          ),
          schemas: baseSchema,
        }),
      ],
      baseSchema,
    )
  }

  return make
}
