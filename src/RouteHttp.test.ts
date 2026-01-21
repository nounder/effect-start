import * as test from "bun:test"
import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"
import * as Http from "./Http.ts"
import * as Route from "./Route.ts"
import * as RouteHttp from "./RouteHttp.ts"
import * as RouteSchema from "./RouteSchema.ts"
import * as RouteTree from "./RouteTree.ts"

test.it("converts string to text/plain for Route.text", async () => {
  const handler = RouteHttp.toWebHandler(
    Route.get(
      Route.text("Hello World"),
    ),
  )
  const response = await Http.fetch(handler, { path: "/text" })

  test
    .expect(response.status)
    .toBe(200)
  test
    .expect(response.headers.get("Content-Type"))
    .toBe("text/plain; charset=utf-8")
  test
    .expect(await response.text())
    .toBe("Hello World")
})

test.it("converts string to text/html for Route.html", async () => {
  const handler = RouteHttp.toWebHandler(
    Route.get(Route.html("<h1>Hello</h1>")),
  )
  const response = await Http.fetch(handler, { path: "/html" })

  test
    .expect(response.status)
    .toBe(200)
  test
    .expect(response.headers.get("Content-Type"))
    .toBe("text/html; charset=utf-8")
  test
    .expect(await response.text())
    .toBe("<h1>Hello</h1>")
})

test.it("converts object to JSON for Route.json", async () => {
  const handler = RouteHttp.toWebHandler(
    Route.get(
      Route.json({ message: "hello", count: 42 }),
    ),
  )
  const response = await Http.fetch(handler, { path: "/json" })

  test
    .expect(response.status)
    .toBe(200)
  test
    .expect(response.headers.get("Content-Type"))
    .toBe("application/json")
  test
    .expect(await response.json())
    .toEqual({ message: "hello", count: 42 })
})

test.it("converts array to JSON for Route.json", async () => {
  const handler = RouteHttp.toWebHandler(
    Route.get(
      Route.json([1, 2, 3]),
    ),
  )
  const response = await Http.fetch(handler, { path: "/array" })

  test
    .expect(response.status)
    .toBe(200)
  test
    .expect(response.headers.get("Content-Type"))
    .toBe("application/json")
  test
    .expect(await response.json())
    .toEqual([1, 2, 3])
})

test.it("handles method-specific routes", async () => {
  const handler = RouteHttp.toWebHandler(
    Route
      .get(Route.text("get resource"))
      .post(Route.text("post resource")),
  )

  const getResponse = await Http.fetch(handler, {
    path: "/resource",
    method: "GET",
  })
  test
    .expect(await getResponse.text())
    .toBe("get resource")

  const postResponse = await Http.fetch(handler, {
    path: "/resource",
    method: "POST",
  })
  test
    .expect(await postResponse.text())
    .toBe("post resource")
})

test.it("handles errors by returning 500 response", async () => {
  const handler = RouteHttp.toWebHandler(
    Route.get(
      Route.text(function*(): Generator<any, string, any> {
        return yield* Effect.fail(new Error("Something went wrong"))
      }),
    ),
  )
  const response = await Http.fetch(handler, { path: "/error" })

  test
    .expect(response.status)
    .toBe(500)

  const text = await response.text()
  test
    .expect(text)
    .toContain("Something went wrong")
})

test.it("handles defects by returning 500 response", async () => {
  const handler = RouteHttp.toWebHandler(
    Route.get(
      Route.text(function*() {
        return yield* Effect.die("Unexpected error")

        return "Hello"
      }),
    ),
  )
  const response = await Http.fetch(handler, { path: "/defect" })

  test
    .expect(response.status)
    .toBe(500)
})

test.it("includes descriptor properties in handler context", async () => {
  let capturedMethod: string | undefined

  const handler = RouteHttp.toWebHandler(
    Route.get(
      Route.text(function*(ctx) {
        capturedMethod = ctx.method
        return "ok"
      }),
    ),
  )
  await Http.fetch(handler, { path: "/test" })

  test
    .expect(capturedMethod)
    .toBe("GET")
})

test.it("returns 405 for wrong method", async () => {
  const handler = RouteHttp.toWebHandler(
    Route.get(Route.text("users")),
  )
  const response = await Http.fetch(handler, {
    path: "/users",
    method: "POST",
  })

  test
    .expect(response.status)
    .toBe(405)
})

test.it("supports POST method", async () => {
  const handler = RouteHttp.toWebHandler(
    Route.post(Route.text("created")),
  )
  const response = await Http.fetch(handler, {
    path: "/users",
    method: "POST",
  })

  test
    .expect(response.status)
    .toBe(200)
  test
    .expect(await response.text())
    .toBe("created")
})

test.it("selects json when Accept prefers application/json", async () => {
  const handler = RouteHttp.toWebHandler(
    Route
      .get(Route.json({ type: "json" }))
      .get(Route.html("<div>html</div>")),
  )
  const response = await Http.fetch(handler, {
    path: "/data",
    headers: { Accept: "application/json" },
  })

  test
    .expect(response.headers.get("Content-Type"))
    .toBe("application/json")
  test
    .expect(await response.json())
    .toEqual({ type: "json" })
})

test.it("selects html when Accept prefers text/html", async () => {
  const handler = RouteHttp.toWebHandler(
    Route
      .get(Route.json({ type: "json" }))
      .get(Route.html("<div>html</div>")),
  )
  const response = await Http.fetch(handler, {
    path: "/data",
    headers: { Accept: "text/html" },
  })

  test
    .expect(response.headers.get("Content-Type"))
    .toBe("text/html; charset=utf-8")
  test
    .expect(await response.text())
    .toBe("<div>html</div>")
})

test.it("selects text/plain when Accept prefers it", async () => {
  const handler = RouteHttp.toWebHandler(
    Route
      .get(Route.text("plain text"))
      .get(Route.json({ type: "json" })),
  )
  const response = await Http.fetch(handler, {
    path: "/data",
    headers: { Accept: "text/plain" },
  })

  test
    .expect(response.headers.get("Content-Type"))
    .toBe("text/plain; charset=utf-8")
  test
    .expect(await response.text())
    .toBe("plain text")
})

test.it("returns first candidate when no Accept header", async () => {
  const handler = RouteHttp.toWebHandler(
    Route
      .get(Route.json({ type: "json" }))
      .get(Route.html("<div>html</div>")),
  )
  const response = await Http.fetch(handler, { path: "/data" })

  test
    .expect(response.headers.get("Content-Type"))
    .toBe("application/json")
})

test.it("handles Accept with quality values", async () => {
  const handler = RouteHttp.toWebHandler(
    Route
      .get(Route.json({ type: "json" }))
      .get(Route.html("<div>html</div>")),
  )
  const response = await Http.fetch(handler, {
    path: "/data",
    headers: { Accept: "text/html;q=0.9, application/json;q=1.0" },
  })

  test
    .expect(response.headers.get("Content-Type"))
    .toBe("application/json")
})

test.it("handles Accept: */*", async () => {
  const handler = RouteHttp.toWebHandler(
    Route
      .get(Route.json({ type: "json" }))
      .get(Route.html("<div>html</div>")),
  )
  const response = await Http.fetch(handler, {
    path: "/data",
    headers: { Accept: "*/*" },
  })

  test
    .expect(response.headers.get("Content-Type"))
    .toBe("application/json")
})

test.it("returns 406 when Accept doesn't match available formats", async () => {
  const handler = RouteHttp.toWebHandler(
    Route.get(Route.json({ type: "json" })),
  )
  const response = await Http.fetch(handler, {
    path: "/data",
    headers: { Accept: "text/html" },
  })

  test
    .expect(response.status)
    .toBe(406)
  test
    .expect(await response.text())
    .toBe("Not Acceptable")
})

test.it("returns 406 when Accept doesn't match any of multiple formats", async () => {
  const handler = RouteHttp.toWebHandler(
    Route
      .get(Route.json({ type: "json" }))
      .get(Route.html("<div>html</div>")),
  )
  const response = await Http.fetch(handler, {
    path: "/data",
    headers: { Accept: "image/png" },
  })

  test
    .expect(response.status)
    .toBe(406)
})

test.it("uses first defined format when no Accept header", async () => {
  const handler = RouteHttp.toWebHandler(
    Route
      .get(Route.json({ type: "json" }))
      .get(Route.text("plain")),
  )
  const response = await Http.fetch(handler, { path: "/data" })

  test
    .expect(response.headers.get("Content-Type"))
    .toBe("application/json")
})

test.it("definition order determines priority when no Accept header", async () => {
  const handler = RouteHttp.toWebHandler(
    Route
      .get(Route.text("plain"))
      .get(Route.html("<div>html</div>")),
  )
  const response = await Http.fetch(handler, { path: "/data" })

  test
    .expect(response.headers.get("Content-Type"))
    .toBe("text/plain; charset=utf-8")
})

test.it("falls back to html when no Accept header and no json or text", async () => {
  const handler = RouteHttp.toWebHandler(
    Route.get(Route.html("<div>html</div>")),
  )
  const response = await Http.fetch(handler, { path: "/data" })

  test
    .expect(response.headers.get("Content-Type"))
    .toBe("text/html; charset=utf-8")
})

test.describe("walkHandles", () => {
  test.it("yields handlers for static routes", () => {
    const tree = RouteTree.make({
      "/users": Route.get(Route.text("users list")),
      "/admin": Route.get(Route.text("admin")),
    })

    const handles = Object.fromEntries(RouteHttp.walkHandles(tree))

    test
      .expect("/users" in handles)
      .toBe(true)
    test
      .expect("/admin" in handles)
      .toBe(true)
  })

  test.it("yields handlers for parameterized routes", () => {
    const tree = RouteTree.make({
      "/users/:id": Route.get(Route.text("user detail")),
    })

    const handles = Object.fromEntries(RouteHttp.walkHandles(tree))

    test
      .expect("/users/:id" in handles)
      .toBe(true)
  })

  test.it("preserves optional param syntax", () => {
    const tree = RouteTree.make({
      "/files/:name?": Route.get(Route.text("files")),
    })

    const handles = Object.fromEntries(RouteHttp.walkHandles(tree))

    test
      .expect("/files/:name?" in handles)
      .toBe(true)
  })

  test.it("preserves wildcard param syntax", () => {
    const tree = RouteTree.make({
      "/docs/:path*": Route.get(Route.text("docs")),
    })

    const handles = Object.fromEntries(RouteHttp.walkHandles(tree))

    test
      .expect("/docs/:path*" in handles)
      .toBe(true)
  })
})

test.describe("middleware chain", () => {
  test.it("passes enriched context to handler", async () => {
    const handler = RouteHttp.toWebHandler(
      Route
        .use(Route.filter({ context: { answer: 42 } }))
        .get(Route.text(function*(ctx) {
          return `The answer is ${ctx.answer}`
        })),
    )
    const response = await Http.fetch(handler, { path: "/test" })

    test
      .expect(response.status)
      .toBe(200)
    test
      .expect(await response.text())
      .toBe("The answer is 42")
  })

  test.it("composes multiple middlewares with cumulative context", async () => {
    const handler = RouteHttp.toWebHandler(
      Route
        .use(Route.filter({ context: { a: 1 } }))
        .use(Route.filter({ context: { b: 2 } }))
        .get(Route.text(function*(ctx) {
          return `a=${ctx.a},b=${ctx.b}`
        })),
    )
    const response = await Http.fetch(handler, { path: "/test" })

    test
      .expect(await response.text())
      .toBe("a=1,b=2")
  })

  test.it("later middleware can access earlier context", async () => {
    const handler = RouteHttp.toWebHandler(
      Route
        .use(Route.filter({ context: { x: 10 } }))
        .use(Route.filter(function*(ctx) {
          return { context: { doubled: ctx.x * 2 } }
        }))
        .get(Route.text(function*(ctx) {
          return `doubled=${ctx.doubled}`
        })),
    )
    const response = await Http.fetch(handler, { path: "/test" })

    test
      .expect(await response.text())
      .toBe("doubled=20")
  })

  test.it("middleware error short-circuits chain", async () => {
    const handler = RouteHttp.toWebHandler(
      Route
        .use(Route.filter(function*() {
          return yield* Effect.fail(new Error("middleware failed"))
        }))
        .get(Route.text("should not reach")),
    )
    const response = await Http.fetch(handler, { path: "/test" })

    test
      .expect(response.status)
      .toBe(500)
    test
      .expect(await response.text())
      .toContain("middleware failed")
  })

  test.it("applies middleware to all methods", async () => {
    const handler = RouteHttp.toWebHandler(
      Route
        .use(Route.filter({ context: { shared: true } }))
        .get(Route.text(function*(ctx) {
          return `GET:${ctx.shared}`
        }))
        .post(Route.text(function*(ctx) {
          return `POST:${ctx.shared}`
        })),
    )

    const getResponse = await Http.fetch(handler, {
      path: "/test",
      method: "GET",
    })
    test
      .expect(await getResponse.text())
      .toBe("GET:true")

    const postResponse = await Http.fetch(handler, {
      path: "/test",
      method: "POST",
    })
    test
      .expect(await postResponse.text())
      .toBe("POST:true")
  })

  test.it("method-specific middleware enriches context for that method", async () => {
    const handler = RouteHttp.toWebHandler(
      Route.get(
        Route.filter({ context: { methodSpecific: true } }),
        Route.text(function*(ctx) {
          return `methodSpecific=${ctx.methodSpecific}`
        }),
      ),
    )
    const response = await Http.fetch(handler, { path: "/test" })

    test
      .expect(await response.text())
      .toBe("methodSpecific=true")
  })

  test.it("wildcard and method-specific middlewares compose in order", async () => {
    const handler = RouteHttp.toWebHandler(
      Route
        .use(Route.filter({ context: { a: 1 } }))
        .get(
          Route.filter({ context: { b: 2 } }),
          Route.text(function*(ctx) {
            return `a=${ctx.a},b=${ctx.b}`
          }),
        ),
    )
    const response = await Http.fetch(handler, { path: "/test" })

    test
      .expect(await response.text())
      .toBe("a=1,b=2")
  })

  test.it("method-specific middleware only affects its method", async () => {
    const handler = RouteHttp.toWebHandler(
      Route
        .get(
          Route.filter({ context: { getOnly: true } }),
          Route.text(function*(ctx) {
            return `GET:${ctx.getOnly}`
          }),
        )
        .post(Route.text(function*(ctx) {
          return `POST:${(ctx as any).getOnly}`
        })),
    )

    const getResponse = await Http.fetch(handler, {
      path: "/test",
      method: "GET",
    })
    test
      .expect(await getResponse.text())
      .toBe("GET:true")

    const postResponse = await Http.fetch(handler, {
      path: "/test",
      method: "POST",
    })
    test
      .expect(await postResponse.text())
      .toBe("POST:undefined")
  })

  test.it("schema headers parsing works with HttpServerRequest service", async () => {
    const handler = RouteHttp.toWebHandler(
      Route.get(
        RouteSchema.schemaHeaders(
          Schema.Struct({
            "x-test": Schema.String,
          }),
        ),
        Route.text(function*(ctx) {
          return `header=${ctx.headers["x-test"]}`
        }),
      ),
    )
    const response = await Http.fetch(handler, {
      path: "/test",
      headers: { "x-test": "test-value" },
    })

    test
      .expect(response.status)
      .toBe(200)
    test
      .expect(await response.text())
      .toBe("header=test-value")
  })

  test.it("merges headers", async () => {
    const handler = RouteHttp.toWebHandler(
      Route
        .use(RouteSchema.schemaHeaders(
          Schema.Struct({
            "x-shared": Schema.String,
          }),
        ))
        .get(
          RouteSchema.schemaHeaders(
            Schema.Struct({
              "x-get-only": Schema.String,
            }),
          ),
          Route.text(function*(ctx) {
            return `shared=${ctx.headers["x-shared"]},getOnly=${
              ctx.headers["x-get-only"]
            }`
          }),
        ),
    )
    const response = await Http.fetch(handler, {
      path: "/test",
      headers: {
        "x-shared": "shared-value",
        "x-get-only": "get-value",
      },
    })

    test
      .expect(response.status)
      .toBe(200)
    test
      .expect(await response.text())
      .toBe("shared=shared-value,getOnly=get-value")
  })
})

test.describe("toWebHandler type constraints", () => {
  test.it("accepts routes with method", () => {
    RouteHttp.toWebHandler(Route.get(Route.text("hello")))
  })

  test.it("accepts multiple routes with methods", () => {
    RouteHttp.toWebHandler(
      Route.get(Route.text("hello")).post(Route.text("world")),
    )
  })

  test.it("rejects routes without method", () => {
    const noMethod = Route.empty.pipe(Route.text("hello"))
    // @ts-expect-error
    RouteHttp.toWebHandler(noMethod)
  })

  test.it("rejects mixed routes where one has method and one doesn't", () => {
    const withMethod = Route.get(Route.text("hello"))
    const withoutMethod = Route.empty.pipe(Route.text("hello"))
    const mixed = [...withMethod, ...withoutMethod] as const
    // @ts-expect-error
    RouteHttp.toWebHandler(mixed)
  })
})
