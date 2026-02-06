/*
 * Adapted from @effect/platform
 */
import type * as Cause from "effect/Cause"
import * as Data from "effect/Data"
import * as Predicate from "effect/Predicate"
import * as Schema from "effect/Schema"
import type * as Types from "effect/Types"

export const TypeId: unique symbol = Symbol.for("@effect/platform/Error/PlatformError")

export type TypeId = typeof TypeId

export const isPlatformError = (u: unknown): u is PlatformError => Predicate.hasProperty(u, TypeId)

export const TypeIdError = <const TypeId extends symbol, const Tag extends string>(
  typeId: TypeId,
  tag: Tag,
): (new <A extends Record<string, any>>(
  args: Types.Simplify<A>,
) => Cause.YieldableError & Record<TypeId, TypeId> & { readonly _tag: Tag } & Readonly<A>) => {
  class Base extends Data.Error<{}> {
    readonly _tag = tag
  }
  ;(Base.prototype as any)[typeId] = typeId
  ;(Base.prototype as any).name = tag
  return Base as any
}

export const Module = Schema.Literal(
  "Clipboard",
  "Command",
  "FileSystem",
  "KeyValueStore",
  "Path",
  "Stream",
  "Terminal",
)

export class BadArgument extends Schema.TaggedError<BadArgument>(
  "@effect/platform/Error/BadArgument",
)("BadArgument", {
  module: Module,
  method: Schema.String,
  description: Schema.optional(Schema.String),
  cause: Schema.optional(Schema.Defect),
}) {
  readonly [TypeId]: typeof TypeId = TypeId

  get message(): string {
    return `${this.module}.${this.method}${this.description ? `: ${this.description}` : ""}`
  }
}

export const SystemErrorReason = Schema.Literal(
  "AlreadyExists",
  "BadResource",
  "Busy",
  "InvalidData",
  "NotFound",
  "PermissionDenied",
  "TimedOut",
  "UnexpectedEof",
  "Unknown",
  "WouldBlock",
  "WriteZero",
)

export type SystemErrorReason = typeof SystemErrorReason.Type

export class SystemError extends Schema.TaggedError<SystemError>(
  "@effect/platform/Error/SystemError",
)("SystemError", {
  reason: SystemErrorReason,
  module: Module,
  method: Schema.String,
  description: Schema.optional(Schema.String),
  syscall: Schema.optional(Schema.String),
  pathOrDescriptor: Schema.optional(Schema.Union(Schema.String, Schema.Number)),
  cause: Schema.optional(Schema.Defect),
}) {
  readonly [TypeId]: typeof TypeId = TypeId

  get message(): string {
    return `${this.reason}: ${this.module}.${this.method}${
      this.pathOrDescriptor !== undefined ? ` (${this.pathOrDescriptor})` : ""
    }${this.description ? `: ${this.description}` : ""}`
  }
}

export type PlatformError = BadArgument | SystemError

export const PlatformError: Schema.Union<[typeof BadArgument, typeof SystemError]> = Schema.Union(
  BadArgument,
  SystemError,
)
