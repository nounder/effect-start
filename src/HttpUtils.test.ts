import * as HttpServerRequest from "@effect/platform/HttpServerRequest"
import * as t from "bun:test"
import * as HttpUtils from "./HttpUtils.ts"

const makeRequest = (url: string, headers: Record<string, string> = {}) =>
  HttpServerRequest.fromWeb(
    new Request(`http://test${url}`, { headers }),
  )

t.describe("makeUrlFromRequest", () => {
  t.it("uses Host header for relative URL", () => {
    const request = makeRequest("/api/users", {
      host: "example.com",
    })
    const url = HttpUtils.makeUrlFromRequest(request)

    t.expect(url.href).toBe("http://example.com/api/users")
  })

  t.it("uses Origin header when present (takes precedence over Host)", () => {
    const request = makeRequest("/api/users", {
      origin: "https://app.example.com",
      host: "example.com",
    })
    const url = HttpUtils.makeUrlFromRequest(request)

    t.expect(url.href).toBe("https://app.example.com/api/users")
  })

  t.it("uses X-Forwarded-Proto for protocol behind reverse proxy", () => {
    const request = makeRequest("/api/users", {
      host: "example.com",
      "x-forwarded-proto": "https",
    })
    const url = HttpUtils.makeUrlFromRequest(request)

    t.expect(url.href).toBe("https://example.com/api/users")
  })

  t.it("falls back to http://localhost when no headers", () => {
    const request = makeRequest("/api/users", {})
    const url = HttpUtils.makeUrlFromRequest(request)

    t.expect(url.href).toBe("http://localhost/api/users")
  })

  t.it("handles URL with query parameters", () => {
    const request = makeRequest("/search?q=test&page=1", {
      host: "example.com",
    })
    const url = HttpUtils.makeUrlFromRequest(request)

    t.expect(url.href).toBe("http://example.com/search?q=test&page=1")
    t.expect(url.searchParams.get("q")).toBe("test")
    t.expect(url.searchParams.get("page")).toBe("1")
  })

  t.it("handles root path", () => {
    const request = makeRequest("/", {
      host: "example.com",
    })
    const url = HttpUtils.makeUrlFromRequest(request)

    t.expect(url.href).toBe("http://example.com/")
    t.expect(url.pathname).toBe("/")
  })
})
