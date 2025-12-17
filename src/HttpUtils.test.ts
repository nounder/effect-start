import * as HttpServerRequest from "@effect/platform/HttpServerRequest"
import * as test from "bun:test"
import * as HttpUtils from "./HttpUtils.ts"

const makeRequest = (url: string, headers: Record<string, string> = {}) =>
  HttpServerRequest.fromWeb(
    new Request(`http://test${url}`, { headers }),
  )

test.describe("makeUrlFromRequest", () => {
  test.it("uses Host header for relative URL", () => {
    const request = makeRequest("/api/users", {
      host: "example.com",
    })
    const url = HttpUtils.makeUrlFromRequest(request)

    test
      .expect(url.href)
      .toBe("http://example.com/api/users")
  })

  test.it("uses Origin header when present (takes precedence over Host)", () => {
    const request = makeRequest("/api/users", {
      origin: "https://app.example.com",
      host: "example.com",
    })
    const url = HttpUtils.makeUrlFromRequest(request)

    test
      .expect(url.href)
      .toBe("https://app.example.com/api/users")
  })

  test.it("uses X-Forwarded-Proto for protocol behind reverse proxy", () => {
    const request = makeRequest("/api/users", {
      host: "example.com",
      "x-forwarded-proto": "https",
    })
    const url = HttpUtils.makeUrlFromRequest(request)

    test
      .expect(url.href)
      .toBe("https://example.com/api/users")
  })

  test.it("falls back to http://localhost when no headers", () => {
    const request = makeRequest("/api/users", {})
    const url = HttpUtils.makeUrlFromRequest(request)

    test
      .expect(url.href)
      .toBe("http://localhost/api/users")
  })

  test.it("handles URL with query parameters", () => {
    const request = makeRequest("/search?q=test&page=1", {
      host: "example.com",
    })
    const url = HttpUtils.makeUrlFromRequest(request)

    test
      .expect(url.href)
      .toBe("http://example.com/search?q=test&page=1")
    test
      .expect(url.searchParams.get("q"))
      .toBe("test")
    test
      .expect(url.searchParams.get("page"))
      .toBe("1")
  })

  test.it("handles root path", () => {
    const request = makeRequest("/", {
      host: "example.com",
    })
    const url = HttpUtils.makeUrlFromRequest(request)

    test
      .expect(url.href)
      .toBe("http://example.com/")
    test
      .expect(url.pathname)
      .toBe("/")
  })
})
