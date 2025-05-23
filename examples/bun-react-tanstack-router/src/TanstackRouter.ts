import {
  generator,
  getConfig,
} from "@tanstack/router-generator"
import {
  Data,
  Effect,
  Layer,
  pipe,
  Stream,
} from "effect"
import {
  watchFileChanges,
} from "../../../src/files.ts"

const dir = import.meta.dir

export class TanstackRouterError
  extends Data.TaggedError("TanstackRouterError")<{
    message: string
    cause?: unknown
  }>
{}

export function layer() {
  const root = process.cwd()

  return Layer.scopedDiscard(
    Effect.gen(function*() {
      yield* pipe(
        watchFileChanges(root),
        Stream.runForEach(() =>
          Effect.tryPromise({
            try: () => generator(getConfig({}, root), root),
            catch: cause =>
              new TanstackRouterError({
                message: "Failed to generate routes",
                cause,
              }),
          })
        ),
      )
    }),
  )
}
