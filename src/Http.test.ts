import * as test from "bun:test"
import * as Http from "./Http.ts"

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

  test.it("parses single string field", async () => {
    const formData = new FormData()
    formData.append("name", "John")

    const request = createFormDataRequest(formData)
    const result = await Http.parseFormData(request)

    test
      .expect(result)
      .toEqual({
        name: "John",
      })
  })

  test.it("parses multiple string fields", async () => {
    const formData = new FormData()
    formData.append("name", "John")
    formData.append("email", "john@example.com")

    const request = createFormDataRequest(formData)
    const result = await Http.parseFormData(request)

    test
      .expect(result)
      .toEqual({
        name: "John",
        email: "john@example.com",
      })
  })

  test.it("parses multiple values for same key as array", async () => {
    const formData = new FormData()
    formData.append("tags", "red")
    formData.append("tags", "blue")
    formData.append("tags", "green")

    const request = createFormDataRequest(formData)
    const result = await Http.parseFormData(request)

    test
      .expect(result)
      .toEqual({
        tags: ["red", "blue", "green"],
      })
  })

  test.it("parses single file upload", async () => {
    const formData = new FormData()
    const fileContent = new Uint8Array([72, 101, 108, 108, 111]) // "Hello"
    const file = new File([fileContent], "test.txt", { type: "text/plain" })
    formData.append("document", file)

    const request = createFormDataRequest(formData)
    const result = await Http.parseFormData(request)

    test
      .expect(result.document)
      .toBeDefined()

    const files = result.document as ReadonlyArray<Http.FilePart>

    test
      .expect(files)
      .toHaveLength(1)
    test
      .expect(files[0]._tag)
      .toBe("File")
    test
      .expect(files[0].key)
      .toBe("document")
    test
      .expect(files[0].name)
      .toBe("test.txt")
    test
      .expect(files[0].contentType.startsWith("text/plain"))
      .toBe(true)
    test
      .expect(files[0].content)
      .toEqual(fileContent)
  })

  test.it("parses multiple file uploads for same key", async () => {
    const formData = new FormData()
    const file1 = new File([new Uint8Array([1, 2, 3])], "file1.bin", {
      type: "application/octet-stream",
    })
    const file2 = new File([new Uint8Array([4, 5, 6])], "file2.bin", {
      type: "application/octet-stream",
    })
    formData.append("files", file1)
    formData.append("files", file2)

    const request = createFormDataRequest(formData)
    const result = await Http.parseFormData(request)

    const files = result.files as ReadonlyArray<Http.FilePart>

    test
      .expect(files)
      .toHaveLength(2)
    test
      .expect(files[0].name)
      .toBe("file1.bin")
    test
      .expect(files[0].content)
      .toEqual(new Uint8Array([1, 2, 3]))
    test
      .expect(files[1].name)
      .toBe("file2.bin")
    test
      .expect(files[1].content)
      .toEqual(new Uint8Array([4, 5, 6]))
  })

  test.it("uses default content type for files without type", async () => {
    const formData = new FormData()
    const file = new File([new Uint8Array([1, 2, 3])], "unknown.dat", {
      type: "",
    })
    formData.append("upload", file)

    const request = createFormDataRequest(formData)
    const result = await Http.parseFormData(request)

    const files = result.upload as ReadonlyArray<Http.FilePart>

    test
      .expect(files[0].contentType)
      .toBe("application/octet-stream")
  })

  test.it("parses mixed string fields and file uploads", async () => {
    const formData = new FormData()
    formData.append("title", "My Document")
    const file = new File([new Uint8Array([1, 2, 3])], "doc.pdf", {
      type: "application/pdf",
    })
    formData.append("attachment", file)
    formData.append("description", "A test document")

    const request = createFormDataRequest(formData)
    const result = await Http.parseFormData(request)

    test
      .expect(result.title)
      .toBe("My Document")
    test
      .expect(result.description)
      .toBe("A test document")

    const files = result.attachment as ReadonlyArray<Http.FilePart>

    test
      .expect(files)
      .toHaveLength(1)
    test
      .expect(files[0].name)
      .toBe("doc.pdf")
  })

  test.it("returns empty record for empty form data", async () => {
    const formData = new FormData()

    const request = createFormDataRequest(formData)
    const result = await Http.parseFormData(request)

    test
      .expect(result)
      .toEqual({})
  })

  test.it("parses Blob as file", async () => {
    const formData = new FormData()
    const blob = new Blob([new Uint8Array([10, 20, 30])], { type: "image/png" })
    formData.append("image", blob, "image.png")

    const request = createFormDataRequest(formData)
    const result = await Http.parseFormData(request)

    const files = result.image as ReadonlyArray<Http.FilePart>

    test
      .expect(files)
      .toHaveLength(1)
    test
      .expect(files[0].name)
      .toBe("image.png")
    test
      .expect(files[0].contentType)
      .toBe("image/png")
    test
      .expect(files[0].content)
      .toEqual(new Uint8Array([10, 20, 30]))
  })
})
