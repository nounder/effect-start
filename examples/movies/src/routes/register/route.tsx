import { Route } from "effect-start"
import * as Effect from "effect/Effect"
import * as Option from "effect/Option"
import * as HttpServerRequest from "@effect/platform/HttpServerRequest"
import * as HttpServerResponse from "@effect/platform/HttpServerResponse"
import * as UrlParams from "@effect/platform/UrlParams"
import { Sql } from "../../services/Sql.ts"
import { USER_SESSION } from "../../services/SignedUser.ts"

const SESSION_DURATION = 30 * 24 * 60 * 60 * 1000

export default Route.html(function*() {
  const request = yield* HttpServerRequest.HttpServerRequest

  if (request.method === "GET") {
    return (
      <div>
        <h1>Register</h1>
        <form method="POST" action="/register">
          <div>
            <label htmlFor="name">Name:</label>
            <input type="text" id="name" name="name" required />
          </div>
          <div>
            <label htmlFor="email">Email:</label>
            <input type="email" id="email" name="email" required />
          </div>
          <div>
            <label htmlFor="password">Password:</label>
            <input type="password" id="password" name="password" required />
          </div>
          <button type="submit">Register</button>
        </form>
        <p>
          Already have an account? <a href="/login">Login</a>
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
  }

  const formData = yield* request.urlParamsBody
  const nameOpt = UrlParams.getFirst(formData, "name")
  const emailOpt = UrlParams.getFirst(formData, "email")
  const passwordOpt = UrlParams.getFirst(formData, "password")

  if (Option.isNone(nameOpt) || Option.isNone(emailOpt) || Option.isNone(passwordOpt)) {
    return (
      <div>
        <h1>Error</h1>
        <p>All fields are required</p>
        <a href="/register">Back to registration</a>
      </div>
    )
  }

  const name = nameOpt.value
  const email = emailOpt.value
  const password = passwordOpt.value

  const sql = yield* Sql

  const existingUser = yield* sql.findUserByEmail(email)

  if (existingUser) {
    return (
      <div>
        <h1>Error</h1>
        <p>Email already registered</p>
        <a href="/register">Back to registration</a>
      </div>
    )
  }

  const passwordHash = yield* Effect.promise(() => Bun.password.hash(password))

  const userId = crypto.randomUUID()
  yield* sql.createUser({
    id: userId,
    email,
    passwordHash,
    name,
    isBanned: false,
    isVerified: false,
  })

  const sessionId = yield* sql.createSession(userId, SESSION_DURATION)

  return HttpServerResponse.empty({
    status: 302,
    headers: {
      Location: "/",
      "Set-Cookie": `${USER_SESSION}=${sessionId}; Path=/; HttpOnly; Max-Age=${SESSION_DURATION / 1000}`,
    },
  })
})
