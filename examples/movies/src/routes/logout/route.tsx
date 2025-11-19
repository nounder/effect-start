import { Route } from "effect-start"
import * as HttpServerRequest from "@effect/platform/HttpServerRequest"
import { Sql } from "../../services/Sql.ts"
import { USER_SESSION } from "../../services/SignedUser.ts"

export default Route.html(function*() {
  const request = yield* HttpServerRequest.HttpServerRequest
  const sql = yield* Sql

  const sessionId = request.cookies[USER_SESSION]

  if (sessionId) {
    yield* sql.deleteSession(sessionId)
  }

  return (
    <div>
      <h1>Logged Out</h1>
      <p>You have been successfully logged out.</p>
      <p><a href="/">Go to home page</a></p>
      <p><a href="/login">Login again</a></p>
      <style>{`
        div {
          max-width: 400px;
          margin: 40px auto;
          text-align: center;
        }
        a {
          display: inline-block;
          margin: 10px;
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
})
