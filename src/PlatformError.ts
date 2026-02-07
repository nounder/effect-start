/*
 * Adapted from @effect/platform
 */
import type * as Cause from "effect/Cause"
import * as Data from "effect/Data"
import * as Predicate from "effect/Predicate"
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

export type SystemErrorReason =
  | "AlreadyExists"
  | "BadResource"
  | "Busy"
  | "InvalidData"
  | "NotFound"
  | "PermissionDenied"
  | "TimedOut"
  | "UnexpectedEof"
  | "Unknown"
  | "WouldBlock"
  | "WriteZero"

export class BadArgument extends Data.TaggedError("BadArgument")<{
  module: string
  method: string
  description?: string | undefined
  cause?: unknown
}> {
  readonly [TypeId]: typeof TypeId = TypeId

  get message(): string {
    return `${this.module}.${this.method}${this.description ? `: ${this.description}` : ""}`
  }
}

export class SystemError extends Data.TaggedError("SystemError")<{
  reason: SystemErrorReason
  module: string
  method: string
  description?: string | undefined
  syscall?: string | undefined
  pathOrDescriptor?: string | number | undefined
  cause?: unknown
}> {
  readonly [TypeId]: typeof TypeId = TypeId

  get message(): string {
    return `${this.reason}: ${this.module}.${this.method}${
      this.pathOrDescriptor !== undefined ? ` (${this.pathOrDescriptor})` : ""
    }${this.description ? `: ${this.description}` : ""}`
  }
}

export type PlatformError = BadArgument | SystemError
