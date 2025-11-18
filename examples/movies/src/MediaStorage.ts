import * as Data from "effect/Data"
import * as Effect from "effect/Effect"

export class MediaStorageError extends Data.TaggedError("MediaStorageError")<{
  reason: string
  cause?: unknown
}> {}

export class MediaStorage extends Effect.Service<MediaStorage>()("MediaStorage", {
  effect: Effect.gen(function*() {
    return {
      resolveUrl(objectId: string) {
        return `/media/${objectId}`
      },
      save(file: Blob, objectId: string) {
        return Effect.void
      },
    }
  }),
  dependencies: [],
}) {}
