import { HttpServerResponse } from "@effect/platform"
import { Console, Effect, pipe, Schedule, Stream } from "effect"

export const make = (stream: Stream.Stream<any>) =>
  Effect.gen(function*() {
    const heartbeat = Stream.repeat(
      Stream.succeed({
        type: "Ping" as const,
      }),
      Schedule.spaced("1 seconds"),
    )

    const encoder = new TextEncoder()

    const events = pipe(
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

    return HttpServerResponse.stream(events, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    })
  })
