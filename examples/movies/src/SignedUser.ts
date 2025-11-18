import * as Context from "effect/Context"
import * as Data from "effect/Data"
import * as Effect from "effect/Effect"
import * as HttpMiddleware from "@effect/platform/HttpMiddleware"
import * as HttpServerRequest from "@effect/platform/HttpServerRequest"
import { Sql } from "./Sql.ts"
import { eq } from "drizzle-orm"

export const USER_SESSION = "user_session"

export interface SignedUserData {
  readonly id: string
  readonly email: string
  readonly name: string
  readonly isBanned: boolean
  readonly isVerified: boolean
}

export class SignedUser extends Context.Tag("SignedUser")<
  SignedUser,
  SignedUserData
>() {}

export class SignedUserRequiredError
  extends Data.TaggedError("SignedUserRequiredError")<{}>
{}

export class AuthenticationError extends Data.TaggedError("AuthenticationError")<{
  readonly message: string
}> {}

export const required = Effect.gen(function*() {
  const maybeUser = yield* Effect.serviceOption(SignedUser)
  if (maybeUser._tag === "None") {
    return yield* Effect.fail(new SignedUserRequiredError())
  }
  return maybeUser.value
})

export const middleware = () =>
  HttpMiddleware.make((app) =>
    Effect.gen(function*() {
      const request = yield* HttpServerRequest.HttpServerRequest
      const sessionId = request.cookies[USER_SESSION]

      if (sessionId) {
        const sql = yield* Sql
        const [result] = yield* sql.use((db, schema) =>
          db
            .select({
              user: {
                id: schema.User.id,
                email: schema.User.email,
                name: schema.User.name,
                isBanned: schema.User.isBanned,
                isVerified: schema.User.isVerified,
              },
              session: {
                id: schema.UserSession.id,
                expires: schema.UserSession.expires,
              },
            })
            .from(schema.UserSession)
            .innerJoin(schema.User, eq(schema.User.id, schema.UserSession.userId))
            .where(eq(schema.UserSession.id, sessionId))
        )

        if (result) {
          const { user, session } = result
          const expires = session.expires ? new Date(session.expires) : null
          const now = new Date()

          if (expires && expires > now) {
            const created = new Date()
            const duration = expires.getTime() - created.getTime()
            const remaining = expires.getTime() - now.getTime()

            if (remaining / duration < 0.1) {
              const newExpires = new Date(now.getTime() + duration)
              yield* sql.use((db, schema) =>
                db
                  .update(schema.UserSession)
                  .set({ expires: newExpires })
                  .where(eq(schema.UserSession.id, sessionId))
              )
            }
          }

          return yield* app.pipe(
            Effect.provideService(SignedUser, {
              id: user.id,
              email: user.email,
              name: user.name,
              isBanned: Boolean(user.isBanned),
              isVerified: Boolean(user.isVerified),
            }),
          )
        }
      }

      return yield* app
    })
  )
