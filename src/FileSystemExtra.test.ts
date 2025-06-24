import {
  expect,
  it,
} from "bun:test"
import {
  Effect,
  Fiber,
  pipe,
  Stream,
} from "effect"
import {
  createFsFromVolume,
  Volume,
} from "memfs"
import { watchFileChanges } from "./FileSystemExtra.ts"
import { effectFn } from "./testing.ts"

const effect = effectFn()

it("watches file creation", () =>
  effect(function*() {
    const vol = new Volume()
    const fs = createFsFromVolume(vol)
    vol.mkdirSync("/watch", { recursive: true })

    const events: any[] = []
    const stream = watchFileChanges("/watch", undefined, fs)

    const fiber = yield* pipe(
      stream,
      Stream.take(1),
      Stream.runForEach(e =>
        Effect.sync(() => {
          events.push(e)
        })
      ),
      Effect.fork,
    )

    yield* Effect.sleep(1)

    vol.writeFileSync("/watch/new.txt", "hi")

    yield* Fiber.join(fiber)

    expect(
      events.length,
    )
      .toBe(1)
    expect(
      events[0].path.endsWith("new.txt"),
    )
      .toBe(true)
  }))
