import * as t from "bun:test"

const ServerUrl = "http://localhost:3000"

t.describe("bun-fullstack routes", () => {
  t.it("GET / returns HTML with root layout", async () => {
    const response = await fetch(ServerUrl + "/")

    t.expect(response.status).toBe(200)
    t.expect(response.headers.get("content-type")).toContain("text/html")

    const text = await response.text()
    t.expect(text).toContain("<h1>Root Layout</h1>")
    t.expect(text).toContain("<title>")
  })

  t.it("GET / with Accept: text/plain returns plain text", async () => {
    const response = await fetch(ServerUrl + "/", {
      headers: { Accept: "text/plain" },
    })

    t.expect(response.status).toBe(200)
    t.expect(response.headers.get("content-type")).toContain("text/plain")

    const text = await response.text()
    t.expect(text).toBe("Hello, world!")
  })

  t.it("GET /admin without auth returns 401", async () => {
    const response = await fetch(ServerUrl + "/admin")

    t.expect(response.status).toBe(401)
    t.expect(response.headers.get("www-authenticate")).toBe(
      "Basic realm=\"Admin\"",
    )
  })

  t.it("GET /admin with auth returns admin panel", async () => {
    const credentials = btoa("admin:admin")
    const response = await fetch(ServerUrl + "/admin", {
      headers: {
        Authorization: `Basic ${credentials}`,
      },
    })

    t.expect(response.status).toBe(200)

    const html = await response.text()
    t.expect(html).toContain("<h1>Root Layout</h1>")
    t.expect(html).toContain("<h2>Admin Panel</h2>")
    t.expect(html).toContain("<h3>User Management</h3>")
  })

  t.it("GET /admin/data.json with auth returns JSON", async () => {
    const credentials = btoa("admin:admin")
    const response = await fetch(ServerUrl + "/admin/data.json", {
      headers: {
        Authorization: `Basic ${credentials}`,
      },
    })

    t.expect(response.status).toBe(200)
    t.expect(response.headers.get("content-type")).toContain("application/json")

    const json = await response.json()
    t.expect(json).toHaveProperty("wrappedResponse")
  })
})

