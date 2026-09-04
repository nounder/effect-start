import * as test from "bun:test"
import * as Http from "effect-start/internal/Http"

test.describe("mapHeaders", () => {
  test.it("converts Headers to record with lowercase keys", () => {
    const headers = new Headers({
      "Content-Type": "application/json",
      "X-Custom-Header": "value",
    })

    const record = Http.mapHeaders(headers)

    test
      .expect(record)
      .toEqual({
        "content-type": "application/json",
        "x-custom-header": "value",
      })
  })

  test.it("returns empty record for empty headers", () => {
    const headers = new Headers()
    const record = Http.mapHeaders(headers)

    test
      .expect(record)
      .toEqual({})
  })
})

test.describe("parseCookies", () => {
  test.it("parses cookie header string", () => {
    const cookieHeader = "session=abc123; token=xyz789"
    const cookies = Http.parseCookies(cookieHeader)

    test
      .expect(cookies)
      .toEqual({
        session: "abc123",
        token: "xyz789",
      })
  })

  test.it("handles cookies with = in value", () => {
    const cookieHeader = "data=key=value"
    const cookies = Http.parseCookies(cookieHeader)

    test
      .expect(cookies)
      .toEqual({
        data: "key=value",
      })
  })

  test.it("trims whitespace from cookie names and values", () => {
    const cookieHeader = " session = abc123 ; token = xyz789 "
    const cookies = Http.parseCookies(cookieHeader)

    test
      .expect(cookies)
      .toEqual({
        session: "abc123",
        token: "xyz789",
      })
  })

  test.it("handles empty cookie values", () => {
    const cookieHeader = "session=; token=xyz789"
    const cookies = Http.parseCookies(cookieHeader)

    test
      .expect(cookies)
      .toEqual({
        session: "",
        token: "xyz789",
      })
  })

  test.it("handles cookies without values", () => {
    const cookieHeader = "flag; session=abc123"
    const cookies = Http.parseCookies(cookieHeader)

    test
      .expect(cookies)
      .toEqual({
        flag: undefined,
        session: "abc123",
      })
  })

  test.it("ignores empty parts", () => {
    const cookieHeader = "session=abc123;; ; token=xyz789"
    const cookies = Http.parseCookies(cookieHeader)

    test
      .expect(cookies)
      .toEqual({
        session: "abc123",
        token: "xyz789",
      })
  })

  test.it("returns empty record for null cookie header", () => {
    const cookies = Http.parseCookies(null)

    test
      .expect(cookies)
      .toEqual({})
  })

  test.it("returns empty record for empty cookie header", () => {
    const cookies = Http.parseCookies("")

    test
      .expect(cookies)
      .toEqual({})
  })
})

test.describe("mapUrlSearchParams", () => {
  test.it("converts single values to strings", () => {
    const params = new URLSearchParams("page=1&limit=10")
    const record = Http.mapUrlSearchParams(params)

    test
      .expect(record)
      .toEqual({
        page: "1",
        limit: "10",
      })
  })

  test.it("converts multiple values to arrays", () => {
    const params = new URLSearchParams("tags=red&tags=blue&tags=green")
    const record = Http.mapUrlSearchParams(params)

    test
      .expect(record)
      .toEqual({
        tags: ["red", "blue", "green"],
      })
  })

  test.it("handles mixed single and multiple values", () => {
    const params = new URLSearchParams("page=1&tags=red&tags=blue")
    const record = Http.mapUrlSearchParams(params)

    test
      .expect(record)
      .toEqual({
        page: "1",
        tags: ["red", "blue"],
      })
  })

  test.it("returns empty record for empty params", () => {
    const params = new URLSearchParams()
    const record = Http.mapUrlSearchParams(params)

    test
      .expect(record)
      .toEqual({})
  })
})
