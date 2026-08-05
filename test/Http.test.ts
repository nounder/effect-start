import * as test from "bun:test"
import * as Multipart from "effect-start/Multipart"
import * as Effect from "effect/Effect"
import * as Stream from "effect/Stream"
import * as Http from "../src/internal/Http.ts"

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

test.describe("parseFormData", () => {
  function createFormDataRequest(formData: FormData): Request {
    return new Request("http://localhost/", {
      method: "POST",
      body: formData,
    })
  }

  test.it("maps single and repeated fields", () =>
    Effect
      .gen(function*() {
        const formData = new FormData()
        formData.append("name", "John")
        formData.append("tags", "red")
        formData.append("tags", "blue")

        const result = yield* Effect.promise(() => Http.parseFormData(createFormDataRequest(formData)))

        test
          .expect(result)
          .toEqual({
            name: "John",
            tags: ["red", "blue"],
          })
      })
      .pipe(Effect.runPromise))

  test.it("maps uploaded files without requiring a FileSystem", () =>
    Effect
      .gen(function*() {
        const formData = new FormData()
        const expected = new Uint8Array([72, 101, 108, 108, 111])
        formData.append("document", new File([expected], "test.txt", { type: "text/plain" }))

        const result = yield* Effect.promise(() => Http.parseFormData(createFormDataRequest(formData)))
        const files = result.document

        test
          .expect(Array.isArray(files))
          .toBe(true)

        if (!Array.isArray(files)) return
        const file = files[0]

        test
          .expect(Multipart.isFile(file))
          .toBe(true)

        if (!Multipart.isFile(file)) return

        test
          .expect(file.key)
          .toBe("document")
        test
          .expect(file.name)
          .toBe("test.txt")
        test
          .expect(file.contentType.startsWith("text/plain"))
          .toBe(true)

        const content = yield* Stream.runFold(
          file.content,
          [] as Array<number>,
          (bytes, chunk) => [...bytes, ...chunk],
        )

        test
          .expect(Uint8Array.from(content))
          .toEqual(expected)
        test
          .expect(yield* file.contentEffect)
          .toEqual(expected)
      })
      .pipe(Effect.runPromise))

  test.it("uses a default content type for files without one", () =>
    Effect
      .gen(function*() {
        const formData = new FormData()
        formData.append("upload", new File(["test"], "unknown.dat"))

        const result = yield* Effect.promise(() => Http.parseFormData(createFormDataRequest(formData)))
        const files = result.upload

        test
          .expect(Array.isArray(files) && Multipart.isFile(files[0]) && files[0].contentType)
          .toBe("application/octet-stream")
      })
      .pipe(Effect.runPromise))
})
