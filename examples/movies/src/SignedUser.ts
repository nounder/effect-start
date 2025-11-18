import * as Context from "effect/Context"
import * as Data from "effect/Data"
import * as Effect from "effect/Effect"
import * as Option from "effect/Option"
import { eq } from "drizzle-orm"
import { Sql } from "./Sql.ts"
import { MediaStorage } from "./MediaStorage.ts"

export const USER_SESSION = "user_session"

export interface SignedUserData {
  id: string
  email: string
  name: string
  pfpId: string | null
  pfp: string | null
  isBanned: boolean
  isVerified: boolean
}

export class SignedUser extends Context.Tag("SignedUser")<
  SignedUser,
  SignedUserData
>() {
  static get optional() {
    return Effect.serviceOption(SignedUser)
  }

  static get required() {
    return Effect.flatMap(
      SignedUser.optional,
      Option.match({
        onNone: () => Effect.fail(new SignedUserRequiredError()),
        onSome: Effect.succeed,
      }),
    )
  }
}

export class SignedUserRequiredError
  extends Data.TaggedError("SignedUserRequiredError")<{}>
{}

export class AuthenticationError extends Data.TaggedError("AuthenticationError")<{
  message: string
}> {}

export function getSignedUser(sessionId: string) {
  return Effect.gen(function*() {
    const sql = yield* Sql.Sql
    const [result] = yield* sql.use((db, schema) =>
      db
        .select({
          user: {
            id: schema.User.id,
            email: schema.User.email,
            name: schema.User.name,
            pfpId: schema.User.pfpId,
            isBanned: schema.User.isBanned,
            isVerified: schema.User.isVerified,
          },
          session: {
            id: schema.UserSession.id,
            expires: schema.UserSession.expires,
            created: schema.UserSession.created,
          },
        })
        .from(schema.UserSession)
        .innerJoin(schema.User, eq(schema.User.id, schema.UserSession.userId))
        .where(eq(schema.UserSession.id, sessionId))
    )

    if (!result) {
      return yield* Effect.succeed(Option.none())
    }

    const { user, session } = result
    const expires = session.expires ? new Date(session.expires) : null
    const now = new Date()

    if (!expires || expires <= now) {
      return yield* Effect.succeed(Option.none())
    }

    const duration = expires.getTime() - new Date(session.created!).getTime()
    const remaining = expires.getTime() - now.getTime()

    if (remaining / duration < 0.1) {
      const newExpires = new Date(now.getTime() + duration)
      yield* sql.use((db, schema) =>
        db
          .update(schema.UserSession)
          .set({ expires: newExpires.toISOString() })
          .where(eq(schema.UserSession.id, sessionId))
      )
    }

    const storage = yield* MediaStorage.MediaStorage

    return yield* Effect.succeed(
      Option.some({
        ...user,
        pfp: user.pfpId ? storage.resolveUrl(user.pfpId) : null,
      }),
    )
  })
}

export function createSession(userId: string, durationMs: number = 30 * 24 * 60 * 60 * 1000) {
  return Effect.gen(function*() {
    const sql = yield* Sql.Sql
    const now = new Date()
    const expires = new Date(now.getTime() + durationMs)

    const [session] = yield* sql.use((db, schema) =>
      db
        .insert(schema.UserSession)
        .values({
          userId,
          created: now.toISOString(),
          expires: expires.toISOString(),
        })
        .returning({ id: schema.UserSession.id })
    )

    return session.id
  })
}

export function deleteSession(sessionId: string) {
  return Effect.gen(function*() {
    const sql = yield* Sql.Sql

    yield* sql.use((db, schema) =>
      db
        .delete(schema.UserSession)
        .where(eq(schema.UserSession.id, sessionId))
    )
  })
}
