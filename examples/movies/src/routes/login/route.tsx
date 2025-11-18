import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"
import { eq } from "drizzle-orm"
import { Route } from "effect-start"
import { Sql } from "../../Sql.ts"
import { createSession, USER_SESSION, AuthenticationError } from "../../SignedUser.ts"

const LoginSchema = Schema.Struct({
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

    if (searchParams.has("email")) {
      const email = searchParams.get("email")!
      const password = searchParams.get("password")!

      const sql = yield* Sql.Sql
      const passwordHash = yield* Effect.promise(() => hashPassword(password))

      const users = yield* sql.use((db, schema) =>
        db
          .select()
          .from(schema.User)
          .where(eq(schema.User.email, email))
      )

      if (users.length === 0 || users[0].passwordHash !== passwordHash) {
        return (
          <div>
            <h1>Login</h1>
            <p style="color: red;">Invalid email or password!</p>
            <form method="get" action="/login">
              <div>
                <label>Email: <input type="email" name="email" required /></label>
              </div>
              <div>
                <label>Password: <input type="password" name="password" required /></label>
              </div>
              <div>
                <button type="submit">Login</button>
              </div>
            </form>
            <p>
              <a href="/register">Don't have an account? Register</a>
            </p>
          </div>
        )
      }

      const user = users[0]

      if (user.isBanned === "true") {
        return (
          <div>
            <h1>Login</h1>
            <p style="color: red;">Account is banned!</p>
            <p>
              <a href="/">Go to Home</a>
            </p>
          </div>
        )
      }

      const sessionId = yield* createSession(user.id)

      return (
        <html>
          <head>
            <meta http-equiv="refresh" content="0; url=/" />
            <script>{`document.cookie = "${USER_SESSION}=${sessionId}; path=/; max-age=2592000"`}</script>
          </head>
          <body>
            <p>Login successful! Redirecting...</p>
          </body>
        </html>
      )
    }

    return (
      <div>
        <h1>Login</h1>
        <form method="get" action="/login">
          <div>
            <label>Email: <input type="email" name="email" required /></label>
          </div>
          <div>
            <label>Password: <input type="password" name="password" required /></label>
          </div>
          <div>
            <button type="submit">Login</button>
          </div>
        </form>
        <p>
          <a href="/register">Don't have an account? Register</a>
        </p>
      </div>
    )
  }),
)
