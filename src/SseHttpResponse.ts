import * as HttpServerResponse from "@effect/platform/HttpServerResponse"
import * as Duration from "effect/Duration"
import * as Effect from "effect/Effect"
import * as Function from "effect/Function"
import * as Schedule from "effect/Schedule"
import * as Stream from "effect/Stream"
import * as StreamExtra from "./StreamExtra.ts"

const DefaultHeartbeatInterval = Duration.seconds(5)

export const make = <T = any>(stream: Stream.Stream<T, any>, options?: {
  heartbeatInterval?: Duration.DurationInput
}) =>
  Effect.gen(function*() {
    const heartbeat = Stream.repeat(
      Stream.succeed(null),
      Schedule.spaced(options?.heartbeatInterval ?? DefaultHeartbeatInterval),
    )

    const encoder = new TextEncoder()

    const events = Function.pipe(
      Stream.merge(
        heartbeat.pipe(
          Stream.map(() => ":\n\n"),
        ),
        stream.pipe(
          Stream.map(event => `data: ${JSON.stringify(event)}\n\n`),
        ),
      ),
      // without Stream.tap, only two events are sent
      // Effect.fork(Stream.runDrain) doesn't seem to work.
      // Asked for help here: [2025-04-09]
      // https://discord.com/channels/795981131316985866/1359523331400929341
      Stream.tap(v => Effect.gen(function*() {})),
      Stream.map(str => encoder.encode(str)),
    )

    const toStream = StreamExtra.toReadableStreamRuntimePatched(
      yield* Effect.runtime(),
    )

    // see toStream to understand why we're not using
    // HttpServerResponse.stream here.
    return HttpServerResponse.raw(
      toStream(events),
      {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          "Connection": "keep-alive",
        },
      },
    )
  })
