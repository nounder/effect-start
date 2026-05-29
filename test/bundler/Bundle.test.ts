import * as test from "bun:test"
import * as Bundle from "../../src/bundler/Bundle.ts"

test.describe(Bundle.makeResolver, () => {
  test.it("resolves exact module identifiers", () => {
    const resolve = Bundle.makeResolver({
      "effect-start/datastar": "datastar-abc.js",
    })

    test
      .expect(resolve("effect-start/datastar"))
      .toBe("datastar-abc.js")
  })

  test.it("resolves a relative path with a unique basename", () => {
    const resolve = Bundle.makeResolver({
      "speak/client.ts": "client-xyz.js",
    })

    test
      .expect(resolve("./client.ts"))
      .toBe("client-xyz.js")
  })

  test.it("returns undefined when the relative path does not match", () => {
    const resolve = Bundle.makeResolver({
      "speak/client.ts": "client-xyz.js",
    })

    test
      .expect(resolve("./missing.ts"))
      .toBeUndefined()
  })

  test.describe("ambiguous matches without parent", () => {
    test.it("returns undefined when multiple entrypoints share the basename", () => {
      const resolve = Bundle.makeResolver({
        "chat/client.ts": "client-aaa.js",
        "home/client.ts": "client-bbb.js",
        "speak/client.ts": "client-ccc.js",
      })

      test
        .expect(resolve("./client.ts"))
        .toBeUndefined()
    })

    test.it("still picks an unambiguous longer-tail match", () => {
      const resolve = Bundle.makeResolver({
        "a/b/widget.ts": "widget-xxx.js",
        "other/thing.ts": "thing-yyy.js",
      })

      test
        .expect(resolve("./b/widget.ts"))
        .toBe("widget-xxx.js")
      test
        .expect(resolve("./widget.ts"))
        .toBe("widget-xxx.js")
    })
  })

  test.describe("with parent (import.meta.url) disambiguation", () => {
    const entrypoints = {
      "chat/client.ts": "client-aaa.js",
      "home/client.ts": "client-bbb.js",
      "speak/client.ts": "client-ccc.js",
    }

    test.it("picks the entrypoint living next to the parent", () => {
      const resolve = Bundle.makeResolver(entrypoints)

      test
        .expect(
          resolve("./client.ts", "file:///repo/core/routes/speak/route.tsx"),
        )
        .toBe("client-ccc.js")
      test
        .expect(
          resolve("./client.ts", "file:///repo/core/routes/chat/route.tsx"),
        )
        .toBe("client-aaa.js")
      test
        .expect(
          resolve("./client.ts", "file:///repo/core/routes/home/route.tsx"),
        )
        .toBe("client-bbb.js")
    })

    test.it("accepts plain filesystem paths as parent", () => {
      const resolve = Bundle.makeResolver(entrypoints)

      test
        .expect(
          resolve("./client.ts", "/repo/core/routes/speak/route.tsx"),
        )
        .toBe("client-ccc.js")
    })

    test.it("honors `..` segments in the relative path", () => {
      const resolve = Bundle.makeResolver(entrypoints)

      test
        .expect(
          resolve("../speak/client.ts", "file:///repo/core/routes/home/route.tsx"),
        )
        .toBe("client-ccc.js")
    })

    test.it("returns undefined when the parent points outside any entrypoint dir", () => {
      const resolve = Bundle.makeResolver(entrypoints)

      test
        .expect(
          resolve("./client.ts", "file:///repo/core/routes/other/route.tsx"),
        )
        .toBeUndefined()
    })

    test.it("ignores parent for absolute module identifiers", () => {
      const resolve = Bundle.makeResolver({
        "effect-start/datastar": "datastar-abc.js",
        "chat/client.ts": "client-aaa.js",
      })

      test
        .expect(
          resolve("effect-start/datastar", "file:///repo/core/routes/speak/route.tsx"),
        )
        .toBe("datastar-abc.js")
    })

    test.it("matches when entrypoint keys themselves are file:// URLs", () => {
      const resolve = Bundle.makeResolver({
        "effect-start/datastar": "datastar-abc.js",
        "file:///repo/core/routes/chat/client.ts": "client-aaa.js",
        "file:///repo/core/routes/home/client.ts": "client-bbb.js",
        "file:///repo/core/routes/speak/client.ts": "client-ccc.js",
      })

      test
        .expect(
          resolve("./client.ts", "file:///repo/core/routes/speak/route.tsx"),
        )
        .toBe("client-ccc.js")
      test
        .expect(
          resolve("./client.ts", "file:///repo/core/routes/chat/route.tsx"),
        )
        .toBe("client-aaa.js")
    })
  })
})
