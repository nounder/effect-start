import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"
import { eq } from "drizzle-orm"
import { Route } from "effect-start"
import { Sql } from "../../Sql.ts"
import { createSession, USER_SESSION } from "../../SignedUser.ts"

const RegisterSchema = Schema.Struct({
  name: Schema.String,
  email: Schema.String,
  password: Schema.String,
})

async function hashPassword(password: string): Promise<string> {
  const hasher = new Bun.CryptoHasher("sha256")
  hasher.update(password)
  return hasher.digest("hex")
}

export default Route.html(
  Effect.gen(function*() {
    const request = yield* Route.request
    const url = new URL(request.url)
    const searchParams = url.searchParams

    if (searchParams.has("name")) {
      const name = searchParams.get("name")!
      const email = searchParams.get("email")!
      const password = searchParams.get("password")!

      const sql = yield* Sql.Sql

      const existingUsers = yield* sql.use((db, schema) =>
        db
          .select()
          .from(schema.User)
          .where(eq(schema.User.email, email))
      )

      if (existingUsers.length > 0) {
        return (
          <div>
            <h1>Register</h1>
            <p style="color: red;">Email already registered!</p>
            <form method="get" action="/register">
              <div>
                <label>Name: <input type="text" name="name" required /></label>
              </div>
              <div>
                <label>Email: <input type="email" name="email" required /></label>
              </div>
              <div>
                <label>Password: <input type="password" name="password" required /></label>
              </div>
              <div>
                <button type="submit">Register</button>
              </div>
            </form>
            <p>
              <a href="/login">Already have an account? Login</a>
            </p>
          </div>
        )
      }

      const passwordHash = yield* Effect.promise(() => hashPassword(password))

      const [user] = yield* sql.use((db, schema) =>
        db
          .insert(schema.User)
          .values({
            name,
            email,
            passwordHash,
            pfpId: null,
            isBanned: "false",
            isVerified: "false",
          })
          .returning({ id: schema.User.id })
      )

      const sessionId = yield* createSession(user.id)

      return (
        <html>
          <head>
            <meta http-equiv="refresh" content="0; url=/" />
            <script>{`document.cookie = "${USER_SESSION}=${sessionId}; path=/; max-age=2592000"`}</script>
          </head>
          <body>
            <p>Registration successful! Redirecting...</p>
          </body>
        </html>
      )
    }

    return (
      <div>
        <h1>Register</h1>
        <form method="get" action="/register">
          <div>
            <label>Name: <input type="text" name="name" required /></label>
          </div>
          <div>
            <label>Email: <input type="email" name="email" required /></label>
          </div>
          <div>
            <label>Password: <input type="password" name="password" required /></label>
          </div>
          <div>
            <button type="submit">Register</button>
          </div>
        </form>
        <p>
          <a href="/login">Already have an account? Login</a>
        </p>
      </div>
    )
  }),
)
