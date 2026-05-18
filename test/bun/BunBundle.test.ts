import * as test from "bun:test"
import { BunBundle } from "effect-start/bun"
import * as FileSystem from "effect-start/FileSystem"
import * as Effect from "effect/Effect"
import * as NPath from "node:path"
import * as NodeFileSystem from "../../src/node/NodeFileSystem.ts"

const layer = NodeFileSystem.layer

const artifactText = (
  bundle: {
    resolve: (path: string, parent?: string) => string | undefined
    getArtifact: (path: string) => Blob | undefined
  },
  path: string,
  parent?: string,
) =>
  Effect.gen(function*() {
    const url = bundle.resolve(path, parent)

    test
      .expect(url)
      .toBeString()

    const artifact = bundle.getArtifact(path)!

    test
      .expect(artifact)
      .toBeTruthy()

    return yield* Effect.promise(() => artifact.text())
  })

test.describe("BunBundle resolution", () => {
  test.it("resolves an HTML entrypoint", () =>
    Effect
      .gen(function*() {
        const fs = yield* FileSystem.FileSystem
        const tmpDir = yield* fs.makeTempDirectoryScoped()

        const htmlPath = NPath.join(tmpDir, "index.html")
        const jsPath = NPath.join(tmpDir, "index.ts")

        yield* fs.writeFileString(
          htmlPath,
          `<!DOCTYPE html>
<html>
<body>
  <script src="./index.ts" type="module"></script>
</body>
</html>`,
        )
        yield* fs.writeFileString(
          jsPath,
          `export const greeting = "Hello World";`,
        )

        const bundle = yield* BunBundle.buildClient({
          entrypoints: [htmlPath],
        })

        const url = bundle.resolve("index.html")
        const artifact = bundle.getArtifact("index.html")

        test
          .expect(url)
          .toStartWith("/_bundle/")
        test
          .expect(url)
          .toEndWith(".html")
        test
          .expect(artifact?.type)
          .toContain("text/html")
      })
      .pipe(
        Effect.scoped,
        Effect.provide(layer),
        Effect.runPromise,
      ))

  test.it("gets artifacts by entrypoint and emitted path", () =>
    Effect
      .gen(function*() {
        const fs = yield* FileSystem.FileSystem
        const tmpDir = yield* fs.makeTempDirectoryScoped()

        const jsPath = NPath.join(tmpDir, "module.ts")
        yield* fs.writeFileString(
          jsPath,
          `export const VALUE_MARKER = 42;`,
        )

        const bundle = yield* BunBundle.buildClient({
          entrypoints: [jsPath],
        })

        const url = bundle.resolve("module.ts")!
        const emittedPath = url.replace("/_bundle/", "")
        const byEntrypoint = bundle.getArtifact("module.ts")!
        const byOutputPath = bundle.getArtifact(emittedPath)!
        const source = yield* Effect.promise(() => byOutputPath.text())

        test
          .expect(byEntrypoint)
          .toBe(byOutputPath)
        test
          .expect(byOutputPath.type)
          .toContain("javascript")
        test
          .expect(source)
          .toContain("VALUE_MARKER")
      })
      .pipe(
        Effect.scoped,
        Effect.provide(layer),
        Effect.runPromise,
      ))
})

test.describe("BunBundle entrypoint-to-artifact matching", () => {
  test.it("matches sibling entrypoints with the same basename", () =>
    Effect
      .gen(function*() {
        const fs = yield* FileSystem.FileSystem
        const tmpDir = yield* fs.makeTempDirectoryScoped()

        const homeDir = NPath.join(tmpDir, "home")
        const speakDir = NPath.join(tmpDir, "speak")
        yield* fs.makeDirectory(homeDir, { recursive: true })
        yield* fs.makeDirectory(speakDir, { recursive: true })

        const homeClient = NPath.join(homeDir, "client.ts")
        const speakClient = NPath.join(speakDir, "client.ts")
        yield* fs.writeFileString(
          homeClient,
          `export const HOME_MARKER = "from-home";`,
        )
        yield* fs.writeFileString(
          speakClient,
          `export const SPEAK_MARKER = "from-speak";`,
        )

        const bundle = yield* BunBundle.buildClient({
          entrypoints: [homeClient, speakClient],
        })

        const homeUrl = bundle.resolve("home/client.ts")
        const speakUrl = bundle.resolve("speak/client.ts")
        const homeSource = yield* artifactText(bundle, "home/client.ts")
        const speakSource = yield* artifactText(bundle, "speak/client.ts")

        test
          .expect(homeUrl)
          .not
          .toBe(speakUrl)
        test
          .expect(homeSource)
          .toContain("HOME_MARKER")
        test
          .expect(homeSource)
          .not
          .toContain("SPEAK_MARKER")
        test
          .expect(speakSource)
          .toContain("SPEAK_MARKER")
        test
          .expect(speakSource)
          .not
          .toContain("HOME_MARKER")
      })
      .pipe(
        Effect.scoped,
        Effect.provide(layer),
        Effect.runPromise,
      ))

  test.it("matches package-like paths that share a basename with route files", () =>
    Effect
      .gen(function*() {
        const fs = yield* FileSystem.FileSystem
        const tmpDir = yield* fs.makeTempDirectoryScoped()

        const pkgDir = NPath.join(tmpDir, "node_modules", "fake-pkg")
        yield* fs.makeDirectory(pkgDir, { recursive: true })
        yield* fs.writeFileString(
          NPath.join(pkgDir, "package.json"),
          JSON.stringify({
            name: "fake-pkg",
            type: "module",
            main: "./client.js",
          }),
        )
        yield* fs.writeFileString(
          NPath.join(pkgDir, "client.js"),
          `export const FAKE_PKG_MARKER = "from-fake-pkg";`,
        )

        const routeDir = NPath.join(tmpDir, "routes", "home")
        yield* fs.makeDirectory(routeDir, { recursive: true })
        const routeClient = NPath.join(routeDir, "client.ts")
        yield* fs.writeFileString(
          routeClient,
          `export const ROUTE_MARKER = "from-route";`,
        )

        const bundle = yield* BunBundle.buildClient({
          entrypoints: [
            NPath.join(pkgDir, "client.js"),
            routeClient,
          ],
        })

        const pkgSource = yield* artifactText(
          bundle,
          "node_modules/fake-pkg/client.js",
        )
        const routeSource = yield* artifactText(
          bundle,
          "routes/home/client.ts",
        )

        test
          .expect(pkgSource)
          .toContain("FAKE_PKG_MARKER")
        test
          .expect(routeSource)
          .toContain("ROUTE_MARKER")
        test
          .expect(pkgSource)
          .not
          .toContain("ROUTE_MARKER")
        test
          .expect(routeSource)
          .not
          .toContain("FAKE_PKG_MARKER")
      })
      .pipe(
        Effect.scoped,
        Effect.provide(layer),
        Effect.runPromise,
      ))

  test.it("matches entrypoints when one imports the other", () =>
    Effect
      .gen(function*() {
        const fs = yield* FileSystem.FileSystem
        const tmpDir = yield* fs.makeTempDirectoryScoped()

        const aFile = NPath.join(tmpDir, "a.ts")
        const bFile = NPath.join(tmpDir, "b.ts")
        yield* fs.writeFileString(
          aFile,
          `import { B_MARKER } from "./b.ts"; export const A_MARKER = B_MARKER + "-a";`,
        )
        yield* fs.writeFileString(
          bFile,
          `export const B_MARKER = "from-b";`,
        )

        const bundle = yield* BunBundle.buildClient({
          entrypoints: [aFile, bFile],
        })

        const aUrl = bundle.resolve("a.ts")
        const bUrl = bundle.resolve("b.ts")
        const aSource = yield* artifactText(bundle, "a.ts")
        const bSource = yield* artifactText(bundle, "b.ts")

        test
          .expect(aUrl)
          .not
          .toBe(bUrl)
        test
          .expect(aSource)
          .toContain("A_MARKER")
        test
          .expect(bSource)
          .toContain("B_MARKER")
        test
          .expect(bSource)
          .not
          .toContain("A_MARKER")
      })
      .pipe(
        Effect.scoped,
        Effect.provide(layer),
        Effect.runPromise,
      ))

  test.it("works with a custom naming.entry template", () =>
    Effect
      .gen(function*() {
        const fs = yield* FileSystem.FileSystem
        const tmpDir = yield* fs.makeTempDirectoryScoped()

        const homeDir = NPath.join(tmpDir, "home")
        const speakDir = NPath.join(tmpDir, "speak")
        yield* fs.makeDirectory(homeDir, { recursive: true })
        yield* fs.makeDirectory(speakDir, { recursive: true })

        const homeClient = NPath.join(homeDir, "client.ts")
        const speakClient = NPath.join(speakDir, "client.ts")
        yield* fs.writeFileString(
          homeClient,
          `export const HOME_MARKER = "from-home";`,
        )
        yield* fs.writeFileString(
          speakClient,
          `export const SPEAK_MARKER = "from-speak";`,
        )

        const bundle = yield* BunBundle.buildClient({
          entrypoints: [homeClient, speakClient],
          naming: {
            entry: "fixed-[hash].[ext]",
          },
        })

        const homeSource = yield* artifactText(bundle, "home/client.ts")
        const speakSource = yield* artifactText(bundle, "speak/client.ts")

        test
          .expect(homeSource)
          .toContain("HOME_MARKER")
        test
          .expect(homeSource)
          .not
          .toContain("SPEAK_MARKER")
        test
          .expect(speakSource)
          .toContain("SPEAK_MARKER")
        test
          .expect(speakSource)
          .not
          .toContain("HOME_MARKER")
      })
      .pipe(
        Effect.scoped,
        Effect.provide(layer),
        Effect.runPromise,
      ))

  test.it("matches minified CSS entrypoints with custom names", () =>
    Effect
      .gen(function*() {
        const fs = yield* FileSystem.FileSystem
        const tmpDir = yield* fs.makeTempDirectoryScoped()

        const homeDir = NPath.join(tmpDir, "home")
        const speakDir = NPath.join(tmpDir, "speak")
        yield* fs.makeDirectory(homeDir, { recursive: true })
        yield* fs.makeDirectory(speakDir, { recursive: true })

        const homeCss = NPath.join(homeDir, "style.css")
        const speakCss = NPath.join(speakDir, "style.css")
        yield* fs.writeFileString(homeCss, `.home-marker { color: red; }`)
        yield* fs.writeFileString(speakCss, `.speak-marker { color: blue; }`)

        const bundle = yield* BunBundle.buildClient({
          entrypoints: [homeCss, speakCss],
          minify: true,
          naming: {
            entry: "fixed-[hash].[ext]",
          },
        })

        const homeSource = yield* artifactText(bundle, "home/style.css")
        const speakSource = yield* artifactText(bundle, "speak/style.css")

        test
          .expect(homeSource)
          .toContain("home-marker")
        test
          .expect(homeSource)
          .not
          .toContain("speak-marker")
        test
          .expect(speakSource)
          .toContain("speak-marker")
        test
          .expect(speakSource)
          .not
          .toContain("home-marker")
      })
      .pipe(
        Effect.scoped,
        Effect.provide(layer),
        Effect.runPromise,
      ))

  test.it("fails with BundleError when an entrypoint has no artifact", () =>
    Effect
      .gen(function*() {
        const fs = yield* FileSystem.FileSystem
        const tmpDir = yield* fs.makeTempDirectoryScoped()

        const realFile = NPath.join(tmpDir, "real.ts")
        yield* fs.writeFileString(realFile, `export const X = 1;`)

        const exit = yield* Effect.exit(
          BunBundle.buildClient({
            entrypoints: [realFile, NPath.join(tmpDir, "does-not-exist.ts")],
          }),
        )

        test
          .expect(exit._tag)
          .toBe("Failure")
      })
      .pipe(
        Effect.scoped,
        Effect.provide(layer),
        Effect.runPromise,
      ))

  test.it("resolves bare specifier through bundle.resolve", () =>
    Effect
      .gen(function*() {
        const fs = yield* FileSystem.FileSystem
        const tmpDir = yield* fs.makeTempDirectoryScoped()

        const routeDir = NPath.join(tmpDir, "routes")
        yield* fs.makeDirectory(routeDir, { recursive: true })
        const routeIndex = NPath.join(routeDir, "index.ts")
        yield* fs.writeFileString(
          routeIndex,
          `export const ROUTE_INDEX = 1;`,
        )

        const bundle = yield* BunBundle.buildClient({
          entrypoints: ["effect-start/datastar", routeIndex],
        })

        const datastarUrl = bundle.resolve("effect-start/datastar")
        const routeUrl = bundle.resolve("routes/index.ts")

        test
          .expect(datastarUrl)
          .toBeString()
        test
          .expect(datastarUrl!)
          .toStartWith("/_bundle/")
        test
          .expect(routeUrl)
          .toBeString()
        test
          .expect(routeUrl)
          .not
          .toBe(datastarUrl)
      })
      .pipe(
        Effect.scoped,
        Effect.provide(layer),
        Effect.runPromise,
      ))
})
