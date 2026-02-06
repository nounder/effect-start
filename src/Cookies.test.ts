import * as test from "bun:test"
import * as Option from "effect/Option"
import * as Cookies from "./Cookies.ts"

test.describe("unsafeMakeCookie", () => {
  test.it("creates a valid cookie", () => {
    const cookie = Cookies.unsafeMakeCookie("name", "value")
    test
      .expect(cookie.name)
      .toBe("name")
    test
      .expect(cookie.value)
      .toBe("value")
    test
      .expect(cookie.valueEncoded)
      .toBe("value")
  })

  test.it("encodes special characters in value", () => {
    const cookie = Cookies.unsafeMakeCookie("name", "hello world")
    test
      .expect(cookie.valueEncoded)
      .toBe("hello%20world")
    test
      .expect(cookie.value)
      .toBe("hello world")
  })
})

test.describe("set / get / remove", () => {
  test.it("sets and gets a cookie", () => {
    const cookies = Cookies.unsafeSet(Cookies.empty, "foo", "bar")
    const result = Cookies.getValue(cookies, "foo")
    test
      .expect(Option.getOrThrow(result))
      .toBe("bar")
  })

  test.it("removes a cookie", () => {
    const cookies = Cookies.unsafeSet(Cookies.empty, "foo", "bar")
    const removed = Cookies.remove(cookies, "foo")
    test
      .expect(Option.isNone(Cookies.get(removed, "foo")))
      .toBe(true)
  })

  test.it("get returns None for missing cookie", () => {
    test
      .expect(Option.isNone(Cookies.get(Cookies.empty, "missing")))
      .toBe(true)
  })
})

test.describe("merge", () => {
  test.it("combines two Cookies, second wins on conflict", () => {
    const a = Cookies.unsafeSet(Cookies.empty, "x", "1")
    const b = Cookies.unsafeSet(Cookies.empty, "x", "2")
    const merged = Cookies.merge(a, b)
    test
      .expect(Option.getOrThrow(Cookies.getValue(merged, "x")))
      .toBe("2")
  })
})

test.describe("serializeCookie", () => {
  test.it("serializes a simple cookie", () => {
    const cookie = Cookies.unsafeMakeCookie("name", "value")
    test
      .expect(Cookies.serializeCookie(cookie))
      .toBe("name=value")
  })

  test.it("serializes all options", () => {
    const cookie = Cookies.unsafeMakeCookie("name", "value", {
      domain: "example.com",
      path: "/",
      maxAge: "1 hour",
      httpOnly: true,
      secure: true,
      sameSite: "strict",
      priority: "high",
      partitioned: true,
    })
    const str = Cookies.serializeCookie(cookie)
    test
      .expect(str)
      .toContain("Domain=example.com")
    test
      .expect(str)
      .toContain("Path=/")
    test
      .expect(str)
      .toContain("Max-Age=3600")
    test
      .expect(str)
      .toContain("HttpOnly")
    test
      .expect(str)
      .toContain("Secure")
    test
      .expect(str)
      .toContain("SameSite=Strict")
    test
      .expect(str)
      .toContain("Priority=High")
    test
      .expect(str)
      .toContain("Partitioned")
  })
})

test.describe("toCookieHeader", () => {
  test.it("serializes to Cookie header format", () => {
    let cookies = Cookies.empty
    cookies = Cookies.unsafeSet(cookies, "a", "1")
    cookies = Cookies.unsafeSet(cookies, "b", "2")
    const header = Cookies.toCookieHeader(cookies)
    test
      .expect(header)
      .toBe("a=1; b=2")
  })
})

test.describe("toSetCookieHeaders", () => {
  test.it("returns array of Set-Cookie header strings", () => {
    let cookies = Cookies.empty
    cookies = Cookies.unsafeSet(cookies, "a", "1")
    cookies = Cookies.unsafeSet(cookies, "b", "2")
    const headers = Cookies.toSetCookieHeaders(cookies)
    test
      .expect(headers)
      .toEqual(["a=1", "b=2"])
  })
})

test.describe("parseHeader", () => {
  test.it("parses Cookie header", () => {
    const result = Cookies.parseHeader("foo=bar; baz=qux")
    test
      .expect(result)
      .toEqual({ foo: "bar", baz: "qux" })
  })

  test.it("decodes URI-encoded values", () => {
    const result = Cookies.parseHeader("name=hello%20world")
    test
      .expect(result)
      .toEqual({ name: "hello world" })
  })

  test.it("handles quoted values", () => {
    const result = Cookies.parseHeader('name="value"')
    test
      .expect(result)
      .toEqual({ name: "value" })
  })

  test.it("first value wins for duplicates", () => {
    const result = Cookies.parseHeader("a=1; a=2")
    test
      .expect(result.a)
      .toBe("1")
  })
})

test.describe("fromSetCookie", () => {
  test.it("parses a Set-Cookie header", () => {
    const cookies = Cookies.fromSetCookie(
      "session=abc123; Path=/; HttpOnly; Secure; SameSite=Lax",
    )
    const cookie = Option.getOrThrow(Cookies.get(cookies, "session"))
    test
      .expect(cookie.value)
      .toBe("abc123")
    test
      .expect(cookie.options?.path)
      .toBe("/")
    test
      .expect(cookie.options?.httpOnly)
      .toBe(true)
    test
      .expect(cookie.options?.secure)
      .toBe(true)
    test
      .expect(cookie.options?.sameSite)
      .toBe("lax")
  })

  test.it("parses multiple Set-Cookie headers", () => {
    const cookies = Cookies.fromSetCookie([
      "a=1",
      "b=2; Domain=example.com",
    ])
    test
      .expect(Option.getOrThrow(Cookies.getValue(cookies, "a")))
      .toBe("1")
    const b = Option.getOrThrow(Cookies.get(cookies, "b"))
    test
      .expect(b.value)
      .toBe("2")
    test
      .expect(b.options?.domain)
      .toBe("example.com")
  })

  test.it("parses Max-Age", () => {
    const cookies = Cookies.fromSetCookie("token=xyz; Max-Age=3600")
    const cookie = Option.getOrThrow(Cookies.get(cookies, "token"))
    test
      .expect(cookie.options?.maxAge)
      .toBeDefined()
  })

  test.it("parses Priority", () => {
    const cookies = Cookies.fromSetCookie("x=1; Priority=High")
    const cookie = Option.getOrThrow(Cookies.get(cookies, "x"))
    test
      .expect(cookie.options?.priority)
      .toBe("high")
  })

  test.it("parses Partitioned", () => {
    const cookies = Cookies.fromSetCookie("x=1; Partitioned")
    const cookie = Option.getOrThrow(Cookies.get(cookies, "x"))
    test
      .expect(cookie.options?.partitioned)
      .toBe(true)
  })

  test.it("ignores invalid headers", () => {
    const cookies = Cookies.fromSetCookie("")
    test
      .expect(Cookies.isEmpty(cookies))
      .toBe(true)
  })

  test.it("strips leading dot from domain", () => {
    const cookies = Cookies.fromSetCookie("x=1; Domain=.example.com")
    const cookie = Option.getOrThrow(Cookies.get(cookies, "x"))
    test
      .expect(cookie.options?.domain)
      .toBe("example.com")
  })
})

test.describe("toRecord", () => {
  test.it("converts cookies to name-value record", () => {
    let cookies = Cookies.empty
    cookies = Cookies.unsafeSet(cookies, "a", "1")
    cookies = Cookies.unsafeSet(cookies, "b", "2")
    test
      .expect(Cookies.toRecord(cookies))
      .toEqual({ a: "1", b: "2" })
  })
})

test.describe("isEmpty", () => {
  test.it("returns true for empty", () => {
    test
      .expect(Cookies.isEmpty(Cookies.empty))
      .toBe(true)
  })

  test.it("returns false for non-empty", () => {
    test
      .expect(Cookies.isEmpty(Cookies.unsafeSet(Cookies.empty, "a", "1")))
      .toBe(false)
  })
})
