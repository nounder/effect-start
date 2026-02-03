import * as test from "bun:test"
import type * as Entity from "./Entity.ts"
import * as Route from "./Route.ts"

test.describe(Route.redirect, () => {
  test.it("creates redirect with default 302 status", () => {
    const entity = Route.redirect("/login")

    test
      .expect(entity.status)
      .toBe(302)
    test
      .expect(entity.headers.location)
      .toBe("/login")
    test
      .expect(entity.body)
      .toBe("")
  })

  test.it("creates redirect with custom status", () => {
    const entity = Route.redirect("/new-url", 301)

    test
      .expect(entity.status)
      .toBe(301)
    test
      .expect(entity.headers.location)
      .toBe("/new-url")
  })

  test.it("accepts URL object", () => {
    const entity = Route.redirect(new URL("https://example.com/path"))

    test
      .expect(entity.headers.location)
      .toBe("https://example.com/path")
  })

  test.it("returns Entity<string>", () => {
    const entity = Route.redirect("/login")

    test
      .expectTypeOf(entity)
      .toEqualTypeOf<Entity.Entity<"">>()
  })
})
