import * as test from "bun:test"
import * as NFs from "node:fs"
import * as NOs from "node:os"
import * as NPath from "node:path"
import * as ConfigProvider from "effect/ConfigProvider"
import * as Effect from "effect/Effect"
import * as Exit from "effect/Exit"
import * as Layer from "effect/Layer"
import * as Route from "effect-start/Route"
import { BunRoute, BunServer } from "effect-start/bun"

const staticDir = NPath.resolve(import.meta.dir, "../../static")

const withEnv = (env: Record<string, string | undefined>) =>
  Effect.acquireRelease(
    Effect.sync(() => {
      const original: Record<string, string | undefined> = {}
      for (const key of Object.keys(env)) {
        original[key] = process.env[key]
        if (env[key] === undefined) {
          delete process.env[key]
        } else {
          process.env[key] = env[key]
        }
      }
      return original
    }),
    (original) =>
      Effect.sync(() => {
        for (const key of Object.keys(original)) {
          if (original[key] === undefined) {
            delete process.env[key]
          } else {
            process.env[key] = original[key]
          }
        }
      }),
  )

test.describe("smart port selection", () => {
  test.test.skipIf(process.stdout.isTTY)(
    "uses random port when PORT not set, isTTY=false, CLAUDECODE set",
    () =>
      Effect.gen(function* () {
        yield* withEnv({ CLAUDECODE: "1" })
        const bunServer = yield* BunServer.make({})

        test.expect(bunServer.server.port).not.toBe(3000)
      }).pipe(
        Effect.withConfigProvider(ConfigProvider.fromJson({})),
        Effect.scoped,
        Effect.runPromise,
      ),
  )

  test.test("uses explicit PORT even when CLAUDECODE is set", () =>
    Effect.gen(function* () {
      yield* withEnv({ CLAUDECODE: "1" })
      const bunServer = yield* BunServer.make({})

      test.expect(bunServer.server.port).toBe(5678)
    }).pipe(
      Effect.withConfigProvider(ConfigProvider.fromJson({ PORT: "5678" })),
      Effect.scoped,
      Effect.runPromise,
    ),
  )
})

const testLayer = (routes: ReturnType<typeof Route.tree>) =>
  BunServer.layerRoutes({ port: 0 }).pipe(Layer.provide(Route.layer(routes)))

test.describe("routes", () => {
  test.test("serves static text route", () => {
    const routes = Route.tree({
      "/": Route.get(Route.text("Hello, World!")),
    })

    return Effect.gen(function* () {
      const bunServer = yield* BunServer.BunServer
      const response = yield* Effect.promise(() =>
        fetch(`http://localhost:${bunServer.server.port}/`),
      )
      const text = yield* Effect.promise(() => response.text())

      test.expect(response.status).toBe(200)
      test.expect(text).toBe("Hello, World!")
    }).pipe(Effect.provide(testLayer(routes)), Effect.scoped, Effect.runPromise)
  })

  test.test("serves JSON route", () => {
    const routes = Route.tree({
      "/api/data": Route.get(Route.json({ message: "success", value: 42 })),
    })

    return Effect.gen(function* () {
      const bunServer = yield* BunServer.BunServer
      const response = yield* Effect.promise(() =>
        fetch(`http://localhost:${bunServer.server.port}/api/data`),
      )
      const json = yield* Effect.promise(() => response.json())

      test.expect(response.status).toBe(200)
      test.expect(response.headers.get("Content-Type")).toBe("application/json")
      test.expect(json).toEqual({ message: "success", value: 42 })
    }).pipe(Effect.provide(testLayer(routes)), Effect.scoped, Effect.runPromise)
  })

  test.test("returns 404 for unknown routes", () => {
    const routes = Route.tree({
      "/": Route.get(Route.text("Home")),
    })

    return Effect.gen(function* () {
      const bunServer = yield* BunServer.BunServer
      const response = yield* Effect.promise(() =>
        fetch(`http://localhost:${bunServer.server.port}/unknown`),
      )

      test.expect(response.status).toBe(404)
    }).pipe(Effect.provide(testLayer(routes)), Effect.scoped, Effect.runPromise)
  })

  test.test("handles content negotiation", () => {
    const routes = Route.tree({
      "/data": Route.get(Route.json({ type: "json" })).get(Route.html("<div>html</div>")),
    })

    return Effect.gen(function* () {
      const bunServer = yield* BunServer.BunServer
      const baseUrl = `http://localhost:${bunServer.server.port}`

      const jsonResponse = yield* Effect.promise(() =>
        fetch(`${baseUrl}/data`, {
          headers: { Accept: "application/json" },
        }),
      )
      const jsonBody = yield* Effect.promise(() => jsonResponse.json())

      const htmlResponse = yield* Effect.promise(() =>
        fetch(`${baseUrl}/data`, {
          headers: { Accept: "text/html" },
        }),
      )
      const htmlBody = yield* Effect.promise(() => htmlResponse.text())

      test.expect(jsonResponse.headers.get("Content-Type")).toBe("application/json")
      test.expect(jsonBody).toEqual({ type: "json" })
      test.expect(htmlResponse.headers.get("Content-Type")).toBe("text/html; charset=utf-8")
      test.expect(htmlBody).toBe("<div>html</div>")
    }).pipe(Effect.provide(testLayer(routes)), Effect.scoped, Effect.runPromise)
  })

  test.test("returns 406 for unacceptable content type", () => {
    const routes = Route.tree({
      "/data": Route.get(Route.json({ type: "json" })),
    })

    return Effect.gen(function* () {
      const bunServer = yield* BunServer.BunServer
      const response = yield* Effect.promise(() =>
        fetch(`http://localhost:${bunServer.server.port}/data`, {
          headers: { Accept: "image/png" },
        }),
      )

      test.expect(response.status).toBe(406)
    }).pipe(Effect.provide(testLayer(routes)), Effect.scoped, Effect.runPromise)
  })

  test.test("handles parameterized routes", () => {
    const routes = Route.tree({
      "/users/:id": Route.get(Route.text("user")),
    })

    return Effect.gen(function* () {
      const bunServer = yield* BunServer.BunServer
      const response = yield* Effect.promise(() =>
        fetch(`http://localhost:${bunServer.server.port}/users/123`),
      )
      const text = yield* Effect.promise(() => response.text())

      test.expect(response.status).toBe(200)
      test.expect(text).toBe("user")
    }).pipe(Effect.provide(testLayer(routes)), Effect.scoped, Effect.runPromise)
  })
})

test.describe("Start.serve composition", () => {
  test.test("routes resolve when server layer requires Route.Routes", () => {
    const appLayer = Route.layer(
      Route.tree({
        "/hello": Route.get(Route.text("world")),
      }),
    )

    const serverLayer = BunServer.layerRoutes({ port: 0 })
    const composed = Layer.provide(BunServer.withLogAddress(serverLayer), appLayer)

    return Effect.gen(function* () {
      const bunServer = yield* BunServer.BunServer
      const response = yield* Effect.promise(() =>
        fetch(`http://localhost:${bunServer.server.port}/hello`),
      )
      const text = yield* Effect.promise(() => response.text())

      test.expect(response.status).toBe(200)
      test.expect(text).toBe("world")
    }).pipe(Effect.provide(composed), Effect.scoped, Effect.runPromise)
  })

  test.test("route-agnostic layer starts with fallback handler", () => {
    const routeLayer = Route.layer(
      Route.tree({
        "/hello": Route.get(Route.text("world")),
      }),
    )

    const composed = Layer.provide(
      BunServer.withLogAddress(BunServer.layer({ port: 0 })),
      routeLayer,
    )

    return Effect.gen(function* () {
      const bunServer = yield* BunServer.BunServer
      const response = yield* Effect.promise(() =>
        fetch(`http://localhost:${bunServer.server.port}/hello`),
      )

      test.expect(response.status).toBe(404)
    }).pipe(Effect.provide(composed), Effect.scoped, Effect.runPromise)
  })

  test.test("route-aware layer fails without Route.Routes", async () => {
    const program = Effect.gen(function* () {
      yield* BunServer.BunServer
    }).pipe(Effect.provide(BunServer.layerRoutes({ port: 0 })), Effect.scoped) as Effect.Effect<void, never, never>

    const exit = await Effect.runPromiseExit(program)

    test.expect(Exit.isFailure(exit)).toBe(true)
    if (Exit.isFailure(exit)) {
      test.expect(String(exit.cause)).toContain("effect-start/Routes")
    }
  })
})

test.describe("make", () => {
  test.test("accepts explicit routes", () => {
    const routes = Route.tree({
      "/hello": Route.get(Route.text("world")),
    })

    return Effect.gen(function* () {
      const bunServer = yield* BunServer.make({ port: 0 }, routes)
      const response = yield* Effect.promise(() =>
        fetch(`http://localhost:${bunServer.server.port}/hello`),
      )
      const text = yield* Effect.promise(() => response.text())

      test.expect(response.status).toBe(200)
      test.expect(text).toBe("world")
    }).pipe(Effect.scoped, Effect.runPromise)
  })
})

test.describe("prebuilt htmlBundle", () => {
  const prebuiltBundle: Bun.HTMLBundle = {
    index: `${staticDir}/LayoutSlots.html`,
    files: [
      {
        input: "LayoutSlots.html",
        path: `${staticDir}/LayoutSlots.html`,
        loader: "html",
        isEntry: true,
        headers: {
          etag: "test-etag-html",
          "content-type": "text/html;charset=utf-8",
        },
      },
      {
        input: "test-asset.css",
        path: `${staticDir}/test-asset.css`,
        loader: "css",
        isEntry: true,
        headers: {
          etag: "test-etag-css",
          "content-type": "text/css;charset=utf-8",
        },
      },
    ],
  }

  test.test("serves HTML when loader returns sync prebuilt bundle", () => {
    const routes = Route.tree({
      "/": Route.get(
        BunRoute.htmlBundle(() => prebuiltBundle),
        Route.html("<p>Prebuilt Content</p>"),
      ),
    })

    return Effect.gen(function* () {
      const bunServer = yield* BunServer.BunServer
      const response = yield* Effect.promise(() =>
        fetch(`http://localhost:${bunServer.server.port}/`),
      )
      const html = yield* Effect.promise(() => response.text())

      test.expect(response.status).toBe(200)
      test.expect(html).toContain("<p>Prebuilt Content</p>")
      test.expect(html).not.toContain("%children%")
    }).pipe(Effect.provide(testLayer(routes)), Effect.runPromise)
  })

  test.test("serves CSS assets at top-level routes", () => {
    const routes = Route.tree({
      "/": Route.get(
        BunRoute.htmlBundle(() => prebuiltBundle),
        Route.html("<p>content</p>"),
      ),
    })

    return Effect.gen(function* () {
      const bunServer = yield* BunServer.BunServer
      const response = yield* Effect.promise(() =>
        fetch(`http://localhost:${bunServer.server.port}/test-asset.css`),
      )
      const css = yield* Effect.promise(() => response.text())

      test.expect(response.status).toBe(200)
      test.expect(css).toContain("color: red")
      test.expect(response.headers.get("content-type")).toBe("text/css;charset=utf-8")
    }).pipe(Effect.provide(testLayer(routes)), Effect.runPromise)
  })

  test.test("serves prebuilt HTML with correct content-type", () => {
    const routes = Route.tree({
      "/": Route.get(
        BunRoute.htmlBundle(() => prebuiltBundle),
        Route.html("<p>typed</p>"),
      ),
    })

    return Effect.gen(function* () {
      const bunServer = yield* BunServer.BunServer
      const response = yield* Effect.promise(() =>
        fetch(`http://localhost:${bunServer.server.port}/`),
      )

      test.expect(response.status).toBe(200)
      test.expect(response.headers.get("content-type")).toContain("text/html")
    }).pipe(Effect.provide(testLayer(routes)), Effect.runPromise)
  })
})

test.describe("prebuilt htmlBundle rewrites relative asset paths", () => {
  let tmpDir: string
  let bundle: Bun.HTMLBundle

  test.beforeAll(async () => {
    tmpDir = NFs.mkdtempSync(NPath.join(NOs.tmpdir(), "effect-start-test-"))
    const srcDir = NPath.join(tmpDir, "src")
    const outDir = NPath.join(tmpDir, "out")
    NFs.mkdirSync(srcDir)

    NFs.writeFileSync(
      NPath.join(srcDir, "index.html"),
      `<!doctype html>
<html>
  <head>
    <link rel="stylesheet" href="./style.css">
  </head>
  <body>%children%</body>
</html>`,
    )
    NFs.writeFileSync(NPath.join(srcDir, "style.css"), "body { color: blue; }")
    NFs.writeFileSync(
      NPath.join(srcDir, "server.ts"),
      `import html from "./index.html"\nexport default html`,
    )

    const result = await Bun.build({
      entrypoints: [NPath.join(srcDir, "server.ts")],
      outdir: outDir,
      target: "bun",
    })
    if (!result.success) throw new Error("Bun.build failed")

    const mod = await import(NPath.join(outDir, "server.js"))
    const raw = mod.default as Bun.HTMLBundle

    // Bun.build produces relative paths (e.g. ./index.html, ./chunk-xxx.css).
    // registerPrebuiltBundle resolves them against Bun.main, which in tests is
    // the test runner — not the output directory. Resolve them to absolute paths.
    bundle = {
      index: NPath.resolve(outDir, raw.index),
      files: raw.files!.map((f) => ({ ...f, path: NPath.resolve(outDir, f.path) })),
    }
  })

  test.afterAll(() => {
    NFs.rmSync(tmpDir, { recursive: true, force: true })
  })

  test.test("rewrites relative paths to absolute in HTML served at nested route", () => {
    const routes = Route.tree({
      "/notes/:id": Route.get(
        BunRoute.htmlBundle(() => bundle),
        Route.html("<p>note content</p>"),
      ),
    })

    return Effect.gen(function* () {
      const bunServer = yield* BunServer.BunServer
      const response = yield* Effect.promise(() =>
        fetch(`http://localhost:${bunServer.server.port}/notes/hello`),
      )
      const html = yield* Effect.promise(() => response.text())

      test.expect(html).not.toContain('href="./')
      test.expect(html).not.toContain('src="./')

      const cssFile = bundle.files!.find((f) => f.loader === "css")!
      const cssBasename = NPath.basename(cssFile.path)
      test.expect(html).toContain(`href="/${cssBasename}"`)
    }).pipe(Effect.provide(testLayer(routes)), Effect.runPromise)
  })

  test.test("CSS asset is accessible at top-level path", () => {
    const routes = Route.tree({
      "/notes/:id": Route.get(
        BunRoute.htmlBundle(() => bundle),
        Route.html("<p>note content</p>"),
      ),
    })

    const cssFile = bundle.files!.find((f) => f.loader === "css")!
    const cssBasename = NPath.basename(cssFile.path)

    return Effect.gen(function* () {
      const bunServer = yield* BunServer.BunServer
      const response = yield* Effect.promise(() =>
        fetch(`http://localhost:${bunServer.server.port}/${cssBasename}`),
      )
      test.expect(response.status).toBe(200)
      test.expect(response.headers.get("content-type")).toBe("text/css;charset=utf-8")
    }).pipe(Effect.provide(testLayer(routes)), Effect.runPromise)
  })
})

test.describe("prebuilt htmlBundle with images", () => {
  let tmpDir: string
  let outDir: string
  let bundle: Bun.HTMLBundle

  test.beforeAll(async () => {
    tmpDir = NFs.mkdtempSync(NPath.join(NOs.tmpdir(), "effect-start-img-test-"))
    const srcDir = NPath.join(tmpDir, "src")
    outDir = NPath.join(tmpDir, "out")

    await Bun.write(NPath.join(srcDir, "pixel.gif"), Bun.file(NPath.join(staticDir, "pixel.gif")))
    await Bun.write(NPath.join(srcDir, "icon.svg"), Bun.file(NPath.join(staticDir, "icon.svg")))

    await Bun.write(
      NPath.join(srcDir, "index.html"),
      `<!doctype html>
<html>
  <head>
    <link rel="stylesheet" href="./style.css">
  </head>
  <body>
    <img src="./pixel.gif" alt="Pixel">
    <img src="./icon.svg" alt="Icon">
    %children%
  </body>
</html>`,
    )
    await Bun.write(NPath.join(srcDir, "style.css"), "body { margin: 0; }")
    await Bun.write(
      NPath.join(srcDir, "server.ts"),
      `import html from "./index.html"\nexport default html`,
    )

    const result = await Bun.build({
      entrypoints: [NPath.join(srcDir, "server.ts")],
      outdir: outDir,
      target: "bun",
    })
    if (!result.success) throw new Error("Bun.build failed")

    const mod = await import(NPath.join(outDir, "server.js"))
    const raw = mod.default as Bun.HTMLBundle

    bundle = {
      index: NPath.resolve(outDir, raw.index),
      files: raw.files!.map((f) => ({ ...f, path: NPath.resolve(outDir, f.path) })),
    }
  })

  test.afterAll(async () => {
    await Bun.$`rm -rf ${tmpDir}`.quiet()
  })

  function findOutputFile(name: string): string {
    const stem = name.replace(/\.[^.]+$/, "")
    const files = [...new Bun.Glob("*").scanSync({ cwd: outDir, onlyFiles: true })]
    const match = files.find((f) => f.startsWith(stem) && !f.endsWith(".js"))
    if (!match) throw new Error(`No output file found for ${name}`)
    return match
  }

  test.test("rewrites img src to absolute paths", () => {
    const routes = Route.tree({
      "/bio": Route.get(
        BunRoute.htmlBundle(() => bundle),
        Route.html("<p>bio</p>"),
      ),
    })

    return Effect.gen(function* () {
      const bunServer = yield* BunServer.BunServer
      const response = yield* Effect.promise(() =>
        fetch(`http://localhost:${bunServer.server.port}/bio`),
      )
      const html = yield* Effect.promise(() => response.text())

      test.expect(html).not.toContain('src="./')
      test.expect(html).not.toContain('src="../')

      const gifFile = findOutputFile("pixel.gif")
      test.expect(html).toContain(`src="/${gifFile}"`)

      const svgFile = findOutputFile("icon.svg")
      test.expect(html).toContain(`src="/${svgFile}"`)
    }).pipe(Effect.provide(testLayer(routes)), Effect.runPromise)
  })

  test.test("rewrites img src at deeply nested route", () => {
    const routes = Route.tree({
      "/users/:id/profile": Route.get(
        BunRoute.htmlBundle(() => bundle),
        Route.html("<p>profile</p>"),
      ),
    })

    return Effect.gen(function* () {
      const bunServer = yield* BunServer.BunServer
      const response = yield* Effect.promise(() =>
        fetch(`http://localhost:${bunServer.server.port}/users/42/profile`),
      )
      const html = yield* Effect.promise(() => response.text())

      const gifFile = findOutputFile("pixel.gif")
      test.expect(html).toContain(`src="/${gifFile}"`)
    }).pipe(Effect.provide(testLayer(routes)), Effect.runPromise)
  })

  test.test("bundler does not include images in bundle.files", async () => {
    const gifFile = findOutputFile("pixel.gif")
    const bundledPaths = (bundle.files ?? []).map((f) => NPath.basename(f.path))

    test.expect(bundledPaths).not.toContain(gifFile)
  })
})

test.describe("static file routes", () => {
  test.test("serves static files with correct content-type via Bun.file", () => {
    const gifPath = NPath.join(staticDir, "pixel.gif")
    const svgPath = NPath.join(staticDir, "icon.svg")

    return Effect.gen(function* () {
      const bunServer = yield* BunServer.make({
        port: 0,
      })

      bunServer.server.reload({
        routes: {
          "/pixel.gif": Bun.file(gifPath),
          "/icon.svg": Bun.file(svgPath),
        },
        fetch: () => new Response("not found", { status: 404 }),
      })

      const base = `http://localhost:${bunServer.server.port}`

      const gifResponse = yield* Effect.promise(() => fetch(`${base}/pixel.gif`))
      test.expect(gifResponse.status).toBe(200)
      test.expect(gifResponse.headers.get("content-type")).toBe("image/gif")

      const svgResponse = yield* Effect.promise(() => fetch(`${base}/icon.svg`))
      test.expect(svgResponse.status).toBe(200)
      test.expect(svgResponse.headers.get("content-type")).toBe("image/svg+xml")
    }).pipe(Effect.scoped, Effect.runPromise)
  })

  test.test("HEAD request returns headers without body for Bun.file routes", () => {
    const gifPath = NPath.join(staticDir, "pixel.gif")

    return Effect.gen(function* () {
      const bunServer = yield* BunServer.make({
        port: 0,
      })

      bunServer.server.reload({
        routes: {
          "/pixel.gif": Bun.file(gifPath),
        },
        fetch: () => new Response("not found", { status: 404 }),
      })

      const base = `http://localhost:${bunServer.server.port}`

      const headResponse = yield* Effect.promise(() =>
        fetch(`${base}/pixel.gif`, { method: "HEAD" }),
      )
      test.expect(headResponse.status).toBe(200)
      test.expect(headResponse.headers.get("content-type")).toBe("image/gif")
      test.expect(Number(headResponse.headers.get("content-length"))).toBeGreaterThan(0)

      const body = yield* Effect.promise(() => headResponse.text())
      test.expect(body).toBe("")
    }).pipe(Effect.scoped, Effect.runPromise)
  })
})
