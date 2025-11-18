import { Route } from "effect-start"
import * as HttpServerRequest from "@effect/platform/HttpServerRequest"
import * as HttpServerResponse from "@effect/platform/HttpServerResponse"
import * as Cookies from "@effect/platform/Cookies"
import { Sql } from "../../services/Sql.ts"
import { USER_SESSION } from "../../services/SignedUser.ts"

export default Route.html(function*() {
  const request = yield* HttpServerRequest.HttpServerRequest
  const sql = yield* Sql

  const sessionId = request.cookies[USER_SESSION]

  if (sessionId) {
    yield* sql.deleteSession(sessionId)
  }

  return HttpServerResponse.redirect("/", {
    status: 302,
    cookies: Cookies.remove(Cookies.empty, USER_SESSION),
  })
})
