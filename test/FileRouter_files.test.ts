import * as test from "bun:test"
import * as FileRouter from "effect-start/FileRouter"
import * as FileRouterCodegen from "effect-start/FileRouterCodegen"
import * as FileSystem from "effect-start/FileSystem"
import * as Route from "effect-start/Route"
import * as Effect from "effect/Effect"
import * as NFs from "node:fs"
import * as NOs from "node:os"
import * as NPath from "node:path"
import * as NUrl from "node:url"
import * as NodeFileSystem from "../src/node/NodeFileSystem.ts"

const writeTree = (root: string, files: Record<string, string>) => {
  for (const [path, content] of Object.entries(files)) {
    const full = NPath.join(root, path)
    NFs.mkdirSync(NPath.dirname(full), { recursive: true })
    NFs.writeFileSync(full, content)
  }
}

const withRoutes = (files: Record<string, string>) =>
  Effect.acquireRelease(
    Effect.sync(() => {
      const root = NFs.mkdtempSync(NPath.join(NOs.tmpdir(), "effect-start-"))
      writeTree(root, files)
      return root
    }),
    (root) => Effect.sync(() => NFs.rmSync(root, { recursive: true, force: true })),
  )

const Files = {
  "about/layer.tsx": "",
  "about/route.tsx": "",
  "users/route.tsx": "",
  "users/layer.tsx": "",
  "users/[userId]/route.tsx": "",
  "layer.tsx": "",
}

test.it("walks routes", () =>
  Effect
    .gen(function*() {
      const root = yield* withRoutes(Files)
      const files = yield* FileRouter.walkRoutesDirectory(root)

      test
        .expect(files.map((v) => v.modulePath))
        .toEqual([
          "layer.tsx",
          "about/layer.tsx",
          "about/route.tsx",
          "users/layer.tsx",
          "users/route.tsx",
          "users/[userId]/route.tsx",
        ])
    })
    .pipe(
      Effect.scoped,
      Effect.provide(NodeFileSystem.layer),
      Effect.runPromise,
    ))

test.it("walks routes with rest", () =>
  Effect
    .gen(function*() {
      const root = yield* withRoutes({
        ...Files,
        "[[rest]]/route.tsx": "",
        "users/[[path]]/route.tsx": "",
      })
      const files = yield* FileRouter.walkRoutesDirectory(root)

      test
        .expect(files.map((v) => v.modulePath))
        .toEqual([
          "layer.tsx",
          "about/layer.tsx",
          "about/route.tsx",
          "users/layer.tsx",
          "users/route.tsx",
          "users/[userId]/route.tsx",
          "users/[[path]]/route.tsx",
          "[[rest]]/route.tsx",
        ])
    })
    .pipe(
      Effect.scoped,
      Effect.provide(NodeFileSystem.layer),
      Effect.runPromise,
    ))

test.it("walks routes with groups", () =>
  Effect
    .gen(function*() {
      const root = yield* withRoutes({
        "users/route.tsx": "",
        "(admin)/layer.tsx": "",
        "(admin)/users/manage/route.tsx": "",
      })
      const files = yield* FileRouter.walkRoutesDirectory(root)

      test
        .expect(
          files.map((v) => ({
            modulePath: v.modulePath,
            routePath: v.routePath,
          })),
        )
        .toEqual([
          { modulePath: "(admin)/layer.tsx", routePath: "/" },
          { modulePath: "users/route.tsx", routePath: "/users" },
          {
            modulePath: "(admin)/users/manage/route.tsx",
            routePath: "/users/manage",
          },
        ])
    })
    .pipe(
      Effect.scoped,
      Effect.provide(NodeFileSystem.layer),
      Effect.runPromise,
    ))

test.it("layer without load builds routes in memory without writing manifest", () =>
  Effect
    .gen(function*() {
      const routeModuleUrl = NUrl.pathToFileURL(NPath.join(import.meta.dirname, "../src/Route.ts")).href
      const root = yield* withRoutes({
        "routes/route.ts": `import * as Route from ${JSON.stringify(routeModuleUrl)}

export default Route.get(Route.text("memory"))
`,
      })
      const previousEntrypoint = process.argv[1]
      process.argv[1] = NPath.join(root, "server.ts")
      yield* Effect.addFinalizer(() =>
        Effect.sync(() => {
          process.argv[1] = previousEntrypoint
        })
      )

      const routeMap = yield* Route.Routes.pipe(
        Effect.provide(FileRouter.layer()),
      )
      const fs = yield* FileSystem.FileSystem
      const generated = yield* fs.exists(NPath.join(root, "routes", ".server.ts"))

      test
        .expect(Object.keys(routeMap))
        .toEqual(["/"])
      test
        .expect(routeMap["/"])
        .toHaveLength(1)
      test
        .expect(Route.descriptor<{ method: string }>(routeMap["/"][0]).method)
        .toBe("GET")
      test
        .expect(generated)
        .toBe(false)
    })
    .pipe(
      Effect.scoped,
      Effect.provide(NodeFileSystem.layer),
      Effect.runPromise,
    ))

test.describe("codegen generates manifest by default", () => {
  const tmpDir = NPath.join(import.meta.dirname, ".tmp-test-routes")

  test.beforeAll(() => {
    NFs.rmSync(tmpDir, { recursive: true, force: true })
    NFs.mkdirSync(NPath.join(tmpDir, "about"), { recursive: true })
    NFs.mkdirSync(NPath.join(tmpDir, "users"), { recursive: true })
    NFs.writeFileSync(
      NPath.join(tmpDir, "about/route.tsx"),
      "export default []",
    )
    NFs.writeFileSync(
      NPath.join(tmpDir, "users/route.tsx"),
      "export default []",
    )
  })

  test.afterAll(() => {
    NFs.rmSync(tmpDir, { recursive: true, force: true })
  })

  test.it("update generates manifest", () =>
    Effect
      .gen(function*() {
        yield* FileRouterCodegen.update(tmpDir)

        const fs = yield* FileSystem.FileSystem
        const exists = yield* fs.exists(NPath.join(tmpDir, ".server.ts"))

        test
          .expect(exists)
          .toBe(true)

        const content = yield* fs.readFileString(
          NPath.join(tmpDir, ".server.ts"),
        )

        test
          .expect(content)
          .toContain(
            "Generated by effect-start. DO NOT EDIT.",
          )
        test
          .expect(content)
          .toContain(`"/about":`)
        test
          .expect(content)
          .toContain(`"/users":`)
      })
      .pipe(
        Effect.provide(NodeFileSystem.layer),
        Effect.runPromise,
      ))

  test.it("generates new .server.ts", () =>
    Effect
      .gen(function*() {
        const genPath = NPath.join(tmpDir, ".server.ts")
        NFs.rmSync(genPath, { force: true })

        yield* FileRouterCodegen.dump(tmpDir)

        const fs = yield* FileSystem.FileSystem
        const exists = yield* fs.exists(genPath)

        test
          .expect(exists)
          .toBe(true)
      })
      .pipe(
        Effect.provide(NodeFileSystem.layer),
        Effect.runPromise,
      ))
})
