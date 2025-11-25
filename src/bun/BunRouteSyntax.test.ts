import * as t from "bun:test"
import * as BunRouteSyntax from "./BunRouteSyntax.ts"

t.describe("BunRouteSyntax", () => {
  t.describe("toBunPath", () => {
    t.test("static path unchanged", () => {
      t.expect(BunRouteSyntax.toBunPath("/")).toBe("/")
      t.expect(BunRouteSyntax.toBunPath("/about")).toBe("/about")
      t.expect(BunRouteSyntax.toBunPath("/users/profile")).toBe(
        "/users/profile",
      )
    })

    t.test("dynamic parameter [param] -> :param", () => {
      t.expect(BunRouteSyntax.toBunPath("/users/[id]")).toBe("/users/:id")
      t.expect(BunRouteSyntax.toBunPath("/[category]/[product]")).toBe(
        "/:category/:product",
      )
      t.expect(BunRouteSyntax.toBunPath("/posts/[slug]/comments")).toBe(
        "/posts/:slug/comments",
      )
    })

    t.test("optional parameter [[param]] -> :param (no optional support in Bun)", () => {
      t.expect(BunRouteSyntax.toBunPath("/users/[[id]]")).toBe("/users/:id")
      t.expect(BunRouteSyntax.toBunPath("/[[lang]]/about")).toBe("/:lang/about")
    })

    t.test("catch-all parameter [...param] -> *", () => {
      t.expect(BunRouteSyntax.toBunPath("/docs/[...path]")).toBe("/docs/*")
      t.expect(BunRouteSyntax.toBunPath("/files/[...rest]")).toBe("/files/*")
    })

    t.test("optional catch-all [[...param]] -> *", () => {
      t.expect(BunRouteSyntax.toBunPath("/[[...frontend]]")).toBe("/*")
      t.expect(BunRouteSyntax.toBunPath("/app/[[...slug]]")).toBe("/app/*")
    })

    t.test("mixed segments", () => {
      t.expect(BunRouteSyntax.toBunPath("/api/[version]/users/[id]")).toBe(
        "/api/:version/users/:id",
      )
      t.expect(BunRouteSyntax.toBunPath("/[[lang]]/docs/[...path]")).toBe(
        "/:lang/docs/*",
      )
      t.expect(BunRouteSyntax.toBunPath("/[org]/[repo]/[[...file]]")).toBe(
        "/:org/:repo/*",
      )
    })

    t.test("complex real-world paths", () => {
      t.expect(BunRouteSyntax.toBunPath("/blog/[year]/[month]/[slug]")).toBe(
        "/blog/:year/:month/:slug",
      )
      t.expect(BunRouteSyntax.toBunPath("/[...catchAll]")).toBe("/*")
      t
        .expect(BunRouteSyntax.toBunPath("/shop/[[category]]/[[subcategory]]"))
        .toBe("/shop/:category/:subcategory")
    })

    t.test("depth 2 edge cases", () => {
      t.expect(BunRouteSyntax.toBunPath("/[a]/[b]")).toBe("/:a/:b")
      t.expect(BunRouteSyntax.toBunPath("/[[a]]/[[b]]")).toBe("/:a/:b")
      t.expect(BunRouteSyntax.toBunPath("/[a]/[[b]]")).toBe("/:a/:b")
      t.expect(BunRouteSyntax.toBunPath("/[[a]]/[b]")).toBe("/:a/:b")
      t.expect(BunRouteSyntax.toBunPath("/static/[[...rest]]")).toBe(
        "/static/*",
      )
      t.expect(BunRouteSyntax.toBunPath("/[param]/[...rest]")).toBe("/:param/*")
    })
  })
})
