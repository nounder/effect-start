import { pipe, Stream } from "effect"
import type { WatchOptions } from "node:fs"
import * as NFSP from "node:fs/promises"
import type { BundleEvent } from "./Bundle.ts"

const SOURCE_FILENAME = /\.(tsx?|jsx?|html?|css|json)$/

/**
 * `@effect/platform` doesn't support recursive file watching.
 * This function implements that [2025-05-19]
 */
export const watchFileChanges = (
  path?: string,
  opts?: WatchOptions,
): Stream.Stream<BundleEvent, unknown> => {
  const baseDir = path ?? process.cwd()

  const changes = pipe(
    Stream.fromAsyncIterable(
      NFSP.watch(baseDir, {
        persistent: false,
        recursive: true,
        ...(opts || {}),
      }),
      (e) => e,
    ),
    Stream.filter((event) => SOURCE_FILENAME.test(event.filename!)),
    Stream.filter((event) => !(/node_modules/.test(event.filename!))),
    Stream.rechunk(1),
    Stream.throttle({
      units: 1,
      cost: () => 1,
      duration: "400 millis",
      strategy: "enforce",
    }),
    Stream.map((event) => ({
      type: "Change" as const,
      path: event.filename!,
    })),
  )

  return changes
}
