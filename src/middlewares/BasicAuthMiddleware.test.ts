import * as HttpServerRequest from "@effect/platform/HttpServerRequest"
import * as HttpServerResponse from "@effect/platform/HttpServerResponse"
import * as test from "bun:test"
import * as Effect from "effect/Effect"
import * as BasicAuthMiddleware from "./BasicAuthMiddleware.js"

const mockApp = Effect.succeed(
  HttpServerResponse.text("OK", { status: 200 }),
)

const config: BasicAuthMiddleware.BasicAuthConfig = {
  username: "admin",
  password: "secret",
}

const runWithAuth = (authHeader: string | undefined) => {
  const middleware = BasicAuthMiddleware.make(config)
  const wrappedApp = middleware(mockApp)

  const headers: Record<string, string> = {}
  if (authHeader !== undefined) {
    headers.authorization = authHeader
  }

  const mockRequest = HttpServerRequest.fromWeb(
    new Request("http://localhost/test", { headers }),
  )

  return wrappedApp.pipe(
    Effect.provideService(HttpServerRequest.HttpServerRequest, mockRequest),
    Effect.runPromise,
  )
}

test.describe("BasicAuthMiddleware", () => {
  test.it("returns 401 when no authorization header is present", async () => {
    const response = await runWithAuth(undefined)
    test
      .expect(response.status)
      .toBe(401)
    test
      .expect(response.headers["www-authenticate"])
      .toBe("Basic")
  })

  test.it("returns 401 when authorization header does not start with Basic", async () => {
    const response = await runWithAuth("Bearer token")
    test
      .expect(response.status)
      .toBe(401)
  })

  test.it("returns 401 when credentials are invalid", async () => {
    const invalidCredentials = btoa("wrong:credentials")
    const response = await runWithAuth(`Basic ${invalidCredentials}`)
    test
      .expect(response.status)
      .toBe(401)
  })

  test.it("returns 401 when username is wrong", async () => {
    const invalidCredentials = btoa("wronguser:secret")
    const response = await runWithAuth(`Basic ${invalidCredentials}`)
    test
      .expect(response.status)
      .toBe(401)
  })

  test.it("returns 401 when password is wrong", async () => {
    const invalidCredentials = btoa("admin:wrongpassword")
    const response = await runWithAuth(`Basic ${invalidCredentials}`)
    test
      .expect(response.status)
      .toBe(401)
  })

  test.it("passes through to app when credentials are valid", async () => {
    const validCredentials = btoa("admin:secret")
    const response = await runWithAuth(`Basic ${validCredentials}`)
    test
      .expect(response.status)
      .toBe(200)
  })
})
