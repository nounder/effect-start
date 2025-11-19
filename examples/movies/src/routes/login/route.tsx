import { Route } from "effect-start"
import * as Effect from "effect/Effect"
import * as Option from "effect/Option"
import * as HttpServerRequest from "@effect/platform/HttpServerRequest"
import * as UrlParams from "@effect/platform/UrlParams"
import { Sql } from "../../services/Sql.ts"
import { USER_SESSION } from "../../services/SignedUser.ts"

const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000

export default Route.html(function*() {
  return (
    <div>
      <h1>Login</h1>
      <form method="post" action="/login">
        <div>
          <label for="email">Email:</label>
          <input type="email" id="email" name="email" required />
        </div>
        <div>
          <label for="password">Password:</label>
          <input type="password" id="password" name="password" required />
        </div>
        <button type="submit">Login</button>
      </form>
      <p>
        Don't have an account? <a href="/register">Register</a>
      </p>
      <style>{`
        form {
          max-width: 400px;
          margin: 20px 0;
        }
        div {
          margin-bottom: 15px;
        }
        label {
          display: block;
          margin-bottom: 5px;
        }
        input {
          width: 100%;
          padding: 8px;
          border: 1px solid #ccc;
          border-radius: 4px;
        }
        button {
          padding: 10px 20px;
          background-color: #007bff;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
        }
        button:hover {
          background-color: #0056b3;
        }
      `}</style>
    </div>
  )
}).post(Route.html(function*() {
  const request = yield* HttpServerRequest.HttpServerRequest
  const formData = yield* request.urlParamsBody

  const emailOpt = UrlParams.getFirst(formData, "email")
  const passwordOpt = UrlParams.getFirst(formData, "password")

  if (Option.isNone(emailOpt) || Option.isNone(passwordOpt)) {
    return (
      <div>
        <h1>Error</h1>
        <p>All fields are required</p>
        <a href="/login">Back to login</a>
      </div>
    )
  }

  const email = emailOpt.value
  const password = passwordOpt.value

  const sql = yield* Sql
  const user = yield* sql.findUserByEmail(email)

  if (!user) {
    return (
      <div>
        <h1>Error</h1>
        <p>Invalid email or password</p>
        <a href="/login">Back to login</a>
      </div>
    )
  }

  const isValid = yield* Effect.promise(() => Bun.password.verify(password, user.passwordHash))

  if (!isValid) {
    return (
      <div>
        <h1>Error</h1>
        <p>Invalid email or password</p>
        <a href="/login">Back to login</a>
      </div>
    )
  }

  const sessionId = yield* sql.createSession(user.id, SESSION_DURATION_MS)

  return (
    <div>
      <h1>Login Successful!</h1>
      <p>Welcome back! Your session has been created.</p>
      <p><a href="/">Go to home page</a></p>
      <style>{`
        div {
          max-width: 400px;
          margin: 40px auto;
          text-align: center;
        }
        h1 {
          color: #28a745;
        }
        a {
          display: inline-block;
          margin-top: 20px;
          padding: 10px 20px;
          background-color: #007bff;
          color: white;
          text-decoration: none;
          border-radius: 4px;
        }
        a:hover {
          background-color: #0056b3;
        }
      `}</style>
    </div>
  )
}))
