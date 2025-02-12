import { FileSystem, HttpServerResponse } from "@effect/platform"
import { Effect, pipe, Schedule, Stream } from "effect"
import { watchNodeWithOptions } from "./effect/node.ts"

export default Effect.gen(function*() {
  // keeps the connection open
  const heartbeat = Stream.repeat(
    Stream.succeed(undefined),
    Schedule.spaced("5 seconds"),
  )

  const rootDir = process.cwd()

  const fileChanges = pipe(
    watchNodeWithOptions(yield* FileSystem.FileSystem)(rootDir, {
      recursive: true,
    }),
    Stream.filter(event => event._tag === "Update"),
  )

  const encoder = new TextEncoder()

  const events = pipe(
    Stream.merge(heartbeat, fileChanges),
    Stream.map(event =>
      event !== undefined ? `data: ${JSON.stringify(event)}\n\n` : ":\n\n"
    ),
    Stream.map(str => encoder.encode(str)),
    Stream.throttle({
      units: 1,
      cost: () => 1,
      duration: "100 millis",
      strategy: "enforce",
    }),
  )

  return HttpServerResponse.stream(events, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  })
})
