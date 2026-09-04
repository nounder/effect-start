/**
 * Ported from effect@4.0.0-rc.112.
 */
import type * as Effect from "effect/Effect"
import type * as FileSystem from "effect/FileSystem"
import type * as Path from "effect/Path"
import type * as Scope from "effect/Scope"
import * as Stream from "effect/Stream"
import * as Multipart from "effect/unstable/http/Multipart"
import * as BunStream from "./BunStream.ts"

export const stream = (source: Request): Stream.Stream<Multipart.Part, Multipart.MultipartError> =>
  BunStream
    .fromReadableStream({
      evaluate: () =>
        source.body ?? new ReadableStream({
          start(controller) {
            controller.enqueue(new Uint8Array())
            controller.close()
          },
        }),
      onError: (cause) => Multipart.MultipartError.fromReason("InternalError", cause),
    })
    .pipe(
      Stream.pipeThroughChannel(Multipart.makeChannel(Object.fromEntries(source.headers))),
    )

export const persisted = (
  source: Request,
): Effect.Effect<
  Multipart.Persisted,
  Multipart.MultipartError,
  | FileSystem.FileSystem
  | Path.Path
  | Scope.Scope
> => Multipart.toPersisted(stream(source))
