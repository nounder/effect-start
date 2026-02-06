/** @jsxImportSource effect-start */
import * as test from "bun:test"
import * as Effect from "effect/Effect"
import * as Entity from "../Entity.ts"
import * as Http from "../Http.ts"
import * as Route from "../Route.ts"
import * as RouteHttp from "../RouteHttp.ts"
import * as HyperRoute from "./HyperRoute.ts"

test.describe("HyperRoute.html", () => {
  test.it("renders JSX to HTML string", async () => {
    const handler = RouteHttp.toWebHandler(Route.get(HyperRoute.html(<div>Hello World</div>)))

    const response = await Http.fetch(handler, { path: "/" })

    test.expect(response.status).toBe(200)
    test.expect(response.headers.get("Content-Type")).toBe("text/html; charset=utf-8")
    test.expect(await response.text()).toBe("<div>Hello World</div>")
  })

  test.it("renders nested JSX elements", async () => {
    const handler = RouteHttp.toWebHandler(
      Route.get(
        HyperRoute.html(
          <div class="container">
            <h1>Title</h1>
            <p>Paragraph</p>
          </div>,
        ),
      ),
    )

    const response = await Http.fetch(handler, { path: "/" })

    test
      .expect(await response.text())
      .toBe('<div class="container"><h1>Title</h1><p>Paragraph</p></div>')
  })

  test.it("renders JSX from Effect", async () => {
    const handler = RouteHttp.toWebHandler(
      Route.get(HyperRoute.html(Effect.succeed(<span>From Effect</span>))),
    )

    const response = await Http.fetch(handler, { path: "/" })

    test.expect(await response.text()).toBe("<span>From Effect</span>")
  })

  test.it("renders JSX from generator function", async () => {
    const handler = RouteHttp.toWebHandler(
      Route.get(
        HyperRoute.html(
          Effect.gen(function* () {
            const name = yield* Effect.succeed("World")
            return <div>Hello {name}</div>
          }),
        ),
      ),
    )

    const response = await Http.fetch(handler, { path: "/" })

    test.expect(await response.text()).toBe("<div>Hello World</div>")
  })

  test.it("renders JSX from handler function", async () => {
    const handler = RouteHttp.toWebHandler(
      Route.get(HyperRoute.html((context) => Effect.succeed(<div>Request received</div>))),
    )

    const response = await Http.fetch(handler, { path: "/" })

    test.expect(await response.text()).toBe("<div>Request received</div>")
  })

  test.it("renders JSX with dynamic content", async () => {
    const items = ["Apple", "Banana", "Cherry"]

    const handler = RouteHttp.toWebHandler(
      Route.get(
        HyperRoute.html(
          <ul>
            {items.map((item) => (
              <li>{item}</li>
            ))}
          </ul>,
        ),
      ),
    )

    const response = await Http.fetch(handler, { path: "/" })

    test.expect(await response.text()).toBe("<ul><li>Apple</li><li>Banana</li><li>Cherry</li></ul>")
  })

  test.it("handles Entity with JSX body", async () => {
    const handler = RouteHttp.toWebHandler(
      Route.get(HyperRoute.html(Entity.make(<div>With Entity</div>, { status: 201 }))),
    )

    const response = await Http.fetch(handler, { path: "/" })

    test.expect(response.status).toBe(201)
    test.expect(await response.text()).toBe("<div>With Entity</div>")
  })

  test.it("renders data-* attributes with object values as JSON", async () => {
    const handler = RouteHttp.toWebHandler(
      Route.get(
        HyperRoute.html(
          <div
            data-signals={{
              draft: "",
              pendingDraft: "",
              username: "User123",
            }}
          >
            Content
          </div>,
        ),
      ),
    )

    const response = await Http.fetch(handler, { path: "/" })

    test
      .expect(await response.text())
      .toBe(
        '<div data-signals="{&quot;draft&quot;:&quot;&quot;,&quot;pendingDraft&quot;:&quot;&quot;,&quot;username&quot;:&quot;User123&quot;}">Content</div>',
      )
  })

  test.it("renders script with function child as IIFE", async () => {
    const handler = RouteHttp.toWebHandler(
      Route.get(
        HyperRoute.html(
          <script>
            {(window) => {
              console.log("Hello from", window.document.title)
            }}
          </script>,
        ),
      ),
    )

    const response = await Http.fetch(handler, { path: "/" })
    const text = await response.text()

    test.expect(text).toContain("<script>(")
    test.expect(text).toContain(")(window)</script>")
    test.expect(text).toContain("window.document.title")
  })
})
