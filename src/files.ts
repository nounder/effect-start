import { Console, pipe, Stream } from "effect"
import * as NFSP from "node:fs/promises"
import type { BundleEvent } from "./Bundle.ts"

const SOURCE_FILENAME = /\.(tsx?|jsx?)$/

export const watchFileChanges = (): Stream.Stream<BundleEvent, unknown> => {
  const baseDir = process.cwd()

  const changes = pipe(
    Stream.fromAsyncIterable(
      NFSP.watch(baseDir, {
        persistent: false,
        recursive: true,
      }),
      (e) => e,
    ),
    Stream.filter((event) => SOURCE_FILENAME.test(event.filename!)),
    Stream.filter((event) => !(/node_modules/.test(event.filename!))),
    Stream.rechunk(1),
    Stream.throttle({
      units: 1,
      cost: () => 1,
      duration: "1000 millis",
      strategy: "enforce",
    }),
    Stream.map((event) => ({
      type: "Change" as const,
      path: event.filename!,
    })),
  )

  return changes
}
