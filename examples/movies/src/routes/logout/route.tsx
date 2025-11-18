import * as Effect from "effect/Effect"
import { Route } from "effect-start"
import { deleteSession, USER_SESSION } from "../../SignedUser.ts"

export default Route.html(
  Effect.gen(function*() {
    const request = yield* Route.request
    const cookieHeader = request.headers.get("cookie")

    if (cookieHeader) {
      const cookies = Object.fromEntries(
        cookieHeader.split("; ").map((c) => c.split("="))
      )

      const sessionId = cookies[USER_SESSION]

      if (sessionId) {
        yield* deleteSession(sessionId)
      }
    }

    return (
      <html>
        <head>
          <meta http-equiv="refresh" content="0; url=/" />
          <script>{`document.cookie = "${USER_SESSION}=; path=/; max-age=0"`}</script>
        </head>
        <body>
          <p>Logged out successfully! Redirecting...</p>
        </body>
      </html>
    )
  }),
)
