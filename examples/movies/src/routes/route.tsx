import * as Effect from "effect/Effect"
import * as Option from "effect/Option"
import { Route } from "effect-start"
import { getSignedUser, USER_SESSION } from "../SignedUser.ts"

export default Route.html(
  Effect.gen(function*() {
    const request = yield* Route.request
    const cookieHeader = request.headers.get("cookie")

    let signedUser = Option.none()

    if (cookieHeader) {
      const cookies = Object.fromEntries(
        cookieHeader.split("; ").map((c) => c.split("="))
      )

      const sessionId = cookies[USER_SESSION]

      if (sessionId) {
        signedUser = yield* getSignedUser(sessionId)
      }
    }

    return (
      <div>
        <h1>Movies Demo App</h1>

        {Option.isSome(signedUser)
          ? (
            <div style="margin-bottom: 20px;">
              <p>
                Welcome, <strong>{signedUser.value.name}</strong>!
                {" "}
                (<a href="/logout">Logout</a>)
              </p>
            </div>
          )
          : null}

        <nav>
          <ul>
            <li>
              <a href="/shows">TV Shows</a>
            </li>
            <li>
              <a href="/people">People</a>
            </li>
            {Option.isNone(signedUser)
              ? (
                <>
                  <li>
                    <a href="/login">Login</a>
                  </li>
                  <li>
                    <a href="/register">Register</a>
                  </li>
                </>
              )
              : null}
          </ul>
        </nav>
      </div>
    )
  }),
)
