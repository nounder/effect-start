import * as Duration from "effect/Duration"
import * as Effect from "effect/Effect"
import * as Schedule from "effect/Schedule"
import * as Stream from "effect/Stream"
import type * as Utils from "effect/Utils"
import * as Entity from "./Entity.ts"
import * as Route from "./Route.ts"
import * as StreamExtra from "./StreamExtra.ts"
import type * as Values from "./Values.ts"

const HEARTBEAT_INTERVAL = Duration.seconds(5)
const HEARTBEAT = ": <3\n\n"

export interface SseEvent {
  data?: string | undefined
  type?: string
  retry?: number
}

export type SseTaggedEvent = {
  readonly _tag: string
}

export type SseEventInput = SseEvent | SseTaggedEvent

function isTaggedEvent(event: SseEventInput): event is SseTaggedEvent {
  return Object.hasOwn(event, "_tag") && typeof event["_tag"] === "string"
}

function formatSseEvent(event: SseEventInput): string {
  if (isTaggedEvent(event)) {
    const json = JSON.stringify(event)
    return `event: ${event._tag}\ndata: ${json}\n\n`
  }

  const e = event as SseEvent
  let result = ""
  if (e.type) {
    result += `event: ${e.type}\n`
  }
  if (typeof e.data === "string") {
    for (const line of e.data.split("\n")) {
      result += `data: ${line}\n`
    }
  }
  if (e.retry !== undefined) {
    result += `retry: ${e.retry}\n`
  }
  if (result === "") {
    return ""
  }
  return result + "\n"
}

export type SseHandlerInput<B, E, R> =
  | Stream.Stream<SseEventInput, E, R>
  | Effect.Effect<Stream.Stream<SseEventInput, E, R>, E, R>
  | ((
      context: Values.Simplify<B>,
      next: (context?: Partial<B> & Record<string, unknown>) => Entity.Entity<string>,
    ) =>
      | Stream.Stream<SseEventInput, E, R>
      | Effect.Effect<Stream.Stream<SseEventInput, E, R>, E, R>
      | Generator<
          Utils.YieldWrap<Effect.Effect<unknown, E, R>>,
          Stream.Stream<SseEventInput, E, R>,
          unknown
        >)

export function sse<
  D extends Route.RouteDescriptor.Any,
  B extends {},
  I extends Route.Route.Tuple,
  E = never,
  R = never,
>(handler: SseHandlerInput<NoInfer<D & B & Route.ExtractBindings<I> & { format: "text" }>, E, R>) {
  return function (self: Route.RouteSet.RouteSet<D, B, I>) {
    const sseHandler: Route.Route.Handler<
      D & B & Route.ExtractBindings<I> & { format: "text" },
      Stream.Stream<string, E, R>,
      E,
      R
    > = (ctx, _next) => {
      const getStream = (): Effect.Effect<Stream.Stream<SseEventInput, E, R>, E, R> => {
        if (typeof handler === "function") {
          const result = (handler as Function)(ctx, _next)
          if (StreamExtra.isStream(result)) {
            return Effect.succeed(result as Stream.Stream<SseEventInput, E, R>)
          }
          if (Effect.isEffect(result)) {
            return result as Effect.Effect<Stream.Stream<SseEventInput, E, R>, E, R>
          }
          return Effect.gen(function* () {
            return yield* result
          }) as Effect.Effect<Stream.Stream<SseEventInput, E, R>, E, R>
        }
        if (StreamExtra.isStream(handler)) {
          return Effect.succeed(handler as Stream.Stream<SseEventInput, E, R>)
        }
        if (Effect.isEffect(handler)) {
          return handler as Effect.Effect<Stream.Stream<SseEventInput, E, R>, E, R>
        }
        return Effect.succeed(Stream.empty)
      }

      return Effect.map(getStream(), (eventStream) => {
        const formattedStream = Stream.map(eventStream, formatSseEvent)
        const heartbeat = Stream.repeat(
          Stream.succeed(HEARTBEAT),
          Schedule.spaced(HEARTBEAT_INTERVAL),
        ).pipe(Stream.drop(1))
        const merged = Stream.merge(formattedStream, heartbeat, {
          haltStrategy: "left",
        })
        return Entity.make(merged, {
          headers: {
            "content-type": "text/event-stream",
            "cache-control": "no-cache",
            connection: "keep-alive",
          },
        })
      })
    }

    const route = Route.make<{ format: "text" }, {}, Stream.Stream<string, E, R>, E, R>(
      sseHandler as any,
      { format: "text" },
    )

    const items: [
      ...I,
      Route.Route.Route<{ format: "text" }, {}, Stream.Stream<string, E, R>, E, R>,
    ] = [...Route.items(self), route]

    return Route.set<
      D,
      B,
      [...I, Route.Route.Route<{ format: "text" }, {}, Stream.Stream<string, E, R>, E, R>]
    >(items, Route.descriptor(self))
  }
}
