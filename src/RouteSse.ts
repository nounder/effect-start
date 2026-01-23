import * as Effect from "effect/Effect"
import * as Stream from "effect/Stream"
import type * as Utils from "effect/Utils"
import * as Entity from "./Entity.ts"
import * as Route from "./Route.ts"
import * as StreamExtra from "./StreamExtra.ts"
import type * as Values from "./Values.ts"

export interface SseEvent {
  readonly data?: string | undefined
  readonly event?: string
  readonly retry?: number
}

function formatSseEvent(event: SseEvent): string {
  let result = ""
  if (event.event) {
    result += `event: ${event.event}\n`
  }
  if (event.data != null) {
    for (const line of event.data.split("\n")) {
      result += `data: ${line}\n`
    }
  }
  if (event.retry !== undefined) {
    result += `retry: ${event.retry}\n`
  }
  if (result === "") {
    return ""
  }
  return result + "\n"
}

export type SseHandlerInput<B, E, R> =
  | Stream.Stream<SseEvent, E, R>
  | Effect.Effect<Stream.Stream<SseEvent, E, R>, E, R>
  | ((
    context: Values.Simplify<B>,
    next: (
      context?: Partial<B> & Record<string, unknown>,
    ) => Entity.Entity<string>,
  ) =>
    | Stream.Stream<SseEvent, E, R>
    | Effect.Effect<Stream.Stream<SseEvent, E, R>, E, R>
    | Generator<
      Utils.YieldWrap<Effect.Effect<unknown, E, R>>,
      Stream.Stream<SseEvent, E, R>,
      unknown
    >)

export function sse<
  D extends Route.RouteDescriptor.Any,
  B extends {},
  I extends Route.Route.Tuple,
  E = never,
  R = never,
>(
  handler: SseHandlerInput<
    NoInfer<D & B & Route.ExtractBindings<I> & { format: "text" }>,
    E,
    R
  >,
) {
  return function(
    self: Route.RouteSet.RouteSet<D, B, I>,
  ) {
    const sseHandler: Route.Route.Handler<
      D & B & Route.ExtractBindings<I> & { format: "text" },
      Stream.Stream<string, E, R>,
      E,
      R
    > = (ctx, _next) => {
      const getStream = (): Effect.Effect<Stream.Stream<SseEvent, E, R>, E, R> => {
        if (typeof handler === "function") {
          const result = (handler as Function)(ctx, _next)
          if (StreamExtra.isStream(result)) {
            return Effect.succeed(result as Stream.Stream<SseEvent, E, R>)
          }
          if (Effect.isEffect(result)) {
            return result as Effect.Effect<Stream.Stream<SseEvent, E, R>, E, R>
          }
          return Effect.gen(function*() {
            return yield* result
          }) as Effect.Effect<Stream.Stream<SseEvent, E, R>, E, R>
        }
        if (StreamExtra.isStream(handler)) {
          return Effect.succeed(handler as Stream.Stream<SseEvent, E, R>)
        }
        if (Effect.isEffect(handler)) {
          return handler as Effect.Effect<Stream.Stream<SseEvent, E, R>, E, R>
        }
        return Effect.succeed(Stream.empty)
      }

      return Effect.map(getStream(), (eventStream) => {
        const formattedStream = Stream.map(eventStream, formatSseEvent)
        return Entity.make(formattedStream, {
          headers: {
            "content-type": "text/event-stream",
            "cache-control": "no-cache",
            "connection": "keep-alive",
          },
        })
      })
    }

    const route = Route.make<{ format: "text" }, {}, Stream.Stream<string, E, R>, E, R>(
      sseHandler as any,
      { format: "text" },
    )

    const items: [...I, Route.Route.Route<{ format: "text" }, {}, Stream.Stream<string, E, R>, E, R>] = [
      ...Route.items(self),
      route,
    ]

    return Route.set<
      D,
      B,
      [...I, Route.Route.Route<{ format: "text" }, {}, Stream.Stream<string, E, R>, E, R>]
    >(
      items,
      Route.descriptor(self),
    )
  }
}
