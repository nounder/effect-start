import * as test from "bun:test"
import * as Mime from "effect-start/internal/Mime"

test.it("includes a charset for text content by default", () => {
  test
    .expect(Mime.fromPath("notes.txt"))
    .toBe("text/plain; charset=utf-8")
})

test.it("can omit the charset", () => {
  test
    .expect(Mime.fromPath("notes.txt", { charset: false }))
    .toBe("text/plain")
})
