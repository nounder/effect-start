/*
 * Adapted from @effect/platform
 */
import * as Data from "effect/Data"
import * as Predicate from "effect/Predicate"

const SocketErrorTypeId: unique symbol = Symbol.for("@effect/platform/Socket/SocketError")

export const isSocketError = (u: unknown): u is SocketError =>
  Predicate.hasProperty(u, SocketErrorTypeId)

export class SocketError extends Data.TaggedError("SocketError")<{
  readonly reason: "Write" | "Read" | "Open" | "OpenTimeout" | "Close"
  readonly cause?: unknown
  readonly code?: number | undefined
  readonly closeReason?: string | undefined
}> {
  readonly [SocketErrorTypeId]: typeof SocketErrorTypeId = SocketErrorTypeId

  static isClose(u: unknown): u is SocketError & { reason: "Close" } {
    return isSocketError(u) && u.reason === "Close"
  }

  static isClean(isClean: (code: number) => boolean) {
    return function (u: unknown): u is SocketError & { reason: "Close" } {
      return SocketError.isClose(u) && u.code !== undefined && isClean(u.code)
    }
  }

  get message() {
    if (this.reason === "Close") {
      if (this.closeReason) {
        return `${this.reason}: ${this.code}: ${this.closeReason}`
      }
      return `${this.reason}: ${this.code}`
    }
    return `An error occurred during ${this.reason}`
  }
}

export const defaultCloseCodeIsError = (code: number) => code !== 1000 && code !== 1006
