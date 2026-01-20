import * as test from "bun:test"
import * as Http from "./Http.ts"

test.it("cloneRequest copies request and adds props", () => {
  const request = new Request("http://localhost/test", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  })

  const cloned = Http.cloneRequest(request, { params: { id: "123" } })

  test
    .expect(cloned.url)
    .toBe("http://localhost/test")
  test
    .expect(cloned.method)
    .toBe("POST")
  test
    .expect(cloned.headers.get("Content-Type"))
    .toBe("application/json")
  test
    .expect(cloned.params)
    .toEqual({ id: "123" })
})
