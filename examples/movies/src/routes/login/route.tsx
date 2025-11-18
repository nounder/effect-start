import { Route } from "effect-start"
import * as Effect from "effect/Effect"
import * as HttpServerResponse from "@effect/platform/HttpServerResponse"
import * as Schema from "effect/Schema"
import { Sql } from "../../Sql.ts"
import { USER_SESSION, AuthenticationError } from "../../SignedUser.ts"
import { eq } from "drizzle-orm"

const LoginForm = Schema.Struct({
  email: Schema.String,
  password: Schema.String,
})

export default Route.schemaPost(LoginForm, function*(formData) {
  const sql = yield* Sql

  const [user] = yield* sql.use((db, schema) =>
    db
      .select()
      .from(schema.User)
      .where(eq(schema.User.email, formData.email))
      .limit(1)
  )

  if (!user) {
    return yield* Effect.fail(
      new AuthenticationError({ message: "Invalid email or password" }),
    )
  }

  const isValid = yield* Effect.promise(() => Bun.password.verify(formData.password, user.passwordHash))

  if (!isValid) {
    return yield* Effect.fail(
      new AuthenticationError({ message: "Invalid email or password" }),
    )
  }

  const sessionId = crypto.randomUUID()
  const sessionExpires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)

  yield* sql.use((db, schema) =>
    db.insert(schema.UserSession).values({
      id: sessionId,
      userId: user.id,
      created: new Date(),
      expires: sessionExpires,
    })
  )

  return yield* HttpServerResponse.empty({
    status: 302,
    headers: {
      Location: "/movies",
      "Set-Cookie": `${USER_SESSION}=${sessionId}; Path=/; HttpOnly; Max-Age=${30 * 24 * 60 * 60}`,
    },
  })
})

export const get = Route.html(function*() {
  return (
    <div>
      <h1>Login</h1>
      <form method="POST" action="/login">
        <div style="margin-bottom: 15px;">
          <label for="email">Email:</label><br />
          <input type="email" id="email" name="email" required style="width: 300px; padding: 5px;" />
        </div>
        <div style="margin-bottom: 15px;">
          <label for="password">Password:</label><br />
          <input type="password" id="password" name="password" required style="width: 300px; padding: 5px;" />
        </div>
        <button type="submit" style="padding: 10px 20px; background: #007bff; color: white; border: none; cursor: pointer;">
          Login
        </button>
      </form>
      <p>
        Don't have an account? <a href="/register">Register</a>
      </p>
    </div>
  )
})
