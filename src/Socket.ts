/*
 * Adapted from @effect/platform
 */
import * as Predicate from "effect/Predicate"
import * as PlatformError from "./PlatformError.ts"

export const SocketErrorTypeId: unique symbol = Symbol.for("@effect/platform/Socket/SocketError")

export type SocketErrorTypeId = typeof SocketErrorTypeId

export const isSocketError = (u: unknown): u is SocketError =>
  Predicate.hasProperty(u, SocketErrorTypeId)

export type SocketError = SocketGenericError | SocketCloseError

export class SocketGenericError extends PlatformError.TypeIdError(
  SocketErrorTypeId,
  "SocketError",
)<{
  readonly reason: "Write" | "Read" | "Open" | "OpenTimeout"
  readonly cause: unknown
}> {
  get message() {
    return `An error occurred during ${this.reason}`
  }
}

export class SocketCloseError extends PlatformError.TypeIdError(SocketErrorTypeId, "SocketError")<{
  readonly reason: "Close"
  readonly code: number
  readonly closeReason?: string | undefined
}> {
  static is(u: unknown): u is SocketCloseError {
    return isSocketError(u) && u.reason === "Close"
  }

  static isClean(isClean: (code: number) => boolean) {
    return function (u: unknown): u is SocketCloseError {
      return SocketCloseError.is(u) && isClean(u.code)
    }
  }

  get message() {
    if (this.closeReason) {
      return `${this.reason}: ${this.code}: ${this.closeReason}`
    }
    return `${this.reason}: ${this.code}`
  }
}

export const defaultCloseCodeIsError = (code: number) => code !== 1000 && code !== 1006
