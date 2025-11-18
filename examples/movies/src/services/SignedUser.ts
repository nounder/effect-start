import * as HttpServerRequest from "@effect/platform/HttpServerRequest"
import * as Context from "effect/Context"
import * as Data from "effect/Data"
import * as Effect from "effect/Effect"
import * as Option from "effect/Option"
import { Sql, type User } from "./Sql.ts"

export const USER_SESSION = "user_session"

export class SignedUserRequiredError
  extends Data.TaggedError("SignedUserRequiredError")<{}>
{}

export interface SignedUserData {
  id: string
  email: string
  name: string
  isBanned: boolean
  isVerified: boolean
}

export const SignedUser = Context.GenericTag<SignedUserData>("SignedUser")

export const required = Effect.gen(function*() {
  const maybeUser = yield* Effect.serviceOption(SignedUser)

  if (Option.isNone(maybeUser)) {
    return yield* Effect.fail(new SignedUserRequiredError())
  }

  return maybeUser.value
})

export const middleware = Effect.gen(function*() {
  const request = yield* HttpServerRequest.HttpServerRequest
  const sql = yield* Sql

  const sessionId = request.cookies[USER_SESSION]

  if (!sessionId) {
    return Option.none()
  }

  const result = yield* sql.findSession(sessionId)

  if (!result) {
    return Option.none()
  }

  const { user, session } = result

  if (user.isBanned) {
    return Option.none()
  }

  const expires = new Date(session.expires)
  const now = new Date()

  if (expires <= now) {
    yield* sql.deleteSession(sessionId)
    return Option.none()
  }

  const sessionCreated = new Date(session.created)
  const duration = expires.getTime() - sessionCreated.getTime()
  const remaining = expires.getTime() - now.getTime()

  if (remaining / duration < 0.1) {
    const newExpires = new Date(now.getTime() + duration).toISOString()
    yield* sql.updateSessionExpiry(sessionId, newExpires)
  }

  const signedUser: SignedUserData = {
    id: user.id,
    email: user.email,
    name: user.name,
    isBanned: user.isBanned,
    isVerified: user.isVerified,
  }

  return Option.some(signedUser)
})
