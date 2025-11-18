import { Route } from "effect-start"
import * as Effect from "effect/Effect"
import * as HttpServerRequest from "@effect/platform/HttpServerRequest"
import * as HttpServerResponse from "@effect/platform/HttpServerResponse"
import * as Schema from "effect/Schema"
import { Sql } from "../../Sql.ts"
import { USER_SESSION } from "../../SignedUser.ts"

const RegisterForm = Schema.Struct({
  name: Schema.String,
  email: Schema.String,
  password: Schema.String,
})

export default Route.schemaPost(RegisterForm, function*(formData) {
  const sql = yield* Sql

  const passwordHash = yield* Effect.promise(() => Bun.password.hash(formData.password))

  const userId = crypto.randomUUID()
  const sessionId = crypto.randomUUID()

  yield* sql.use((db, schema) =>
    db.insert(schema.User).values({
      id: userId,
      email: formData.email,
      name: formData.name,
      passwordHash,
      isBanned: false,
      isVerified: false,
      created: new Date(),
      updated: new Date(),
    })
  )

  const sessionExpires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)

  yield* sql.use((db, schema) =>
    db.insert(schema.UserSession).values({
      id: sessionId,
      userId,
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
      <h1>Register</h1>
      <form method="POST" action="/register">
        <div style="margin-bottom: 15px;">
          <label for="name">Name:</label><br />
          <input type="text" id="name" name="name" required style="width: 300px; padding: 5px;" />
        </div>
        <div style="margin-bottom: 15px;">
          <label for="email">Email:</label><br />
          <input type="email" id="email" name="email" required style="width: 300px; padding: 5px;" />
        </div>
        <div style="margin-bottom: 15px;">
          <label for="password">Password:</label><br />
          <input type="password" id="password" name="password" required style="width: 300px; padding: 5px;" />
        </div>
        <button type="submit" style="padding: 10px 20px; background: #007bff; color: white; border: none; cursor: pointer;">
          Register
        </button>
      </form>
      <p>
        Already have an account? <a href="/login">Login</a>
      </p>
    </div>
  )
})
