import * as Data from "effect/Data"
import type * as Effect from "effect/Effect"
import type * as Inspectable from "effect/Inspectable"
import * as Predicate from "effect/Predicate"
import * as Schema from "effect/Schema"
import type * as Stream from "effect/Stream"

export const TypeId = "~effect-start/Multipart"

export interface File extends Inspectable.Inspectable {
  readonly [TypeId]: typeof TypeId
  readonly _tag: "File"
  readonly key: string
  readonly name: string
  readonly contentType: string
  readonly content: Stream.Stream<Uint8Array, MultipartError>
  readonly contentEffect: Effect.Effect<Uint8Array, MultipartError>
}

export const isFile = (input: unknown): input is File =>
  Predicate.hasProperty(input, TypeId) && Predicate.isTagged(input, "File")

export class MultipartError extends Data.TaggedError("MultipartError")<{
  readonly reason: {
    readonly _tag: "Parse" | "InternalError"
    readonly cause?: unknown
  }
}> {}

const fileSchema = Schema.declare(isFile, { identifier: "File" })

export const FilesSchema = Schema.Array(fileSchema)

export const SingleFileSchema = Schema.transform(
  FilesSchema.pipe(Schema.itemsCount(1)),
  fileSchema,
  {
    strict: true,
    decode: (files) => files[0]!,
    encode: (file) => [file],
  },
)
