import * as test from "bun:test"
import { BunFileSystem } from "effect-start/bun"
import * as FileRouter from "effect-start/FileRouter"
import * as FileRouterCodegen from "effect-start/FileRouterCodegen"
import * as Route from "effect-start/Route"
import * as Effect from "effect/Effect"
import * as FileSystem from "effect/FileSystem"
import * as Result from "effect/Result"
import * as NFs from "node:fs"
import * as NOs from "node:os"
import * as NPath from "node:path"
import * as NUrl from "node:url"
import * as FilePathPattern from "../src/internal/FilePathPattern.ts"

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
      Effect.provide(BunFileSystem.layer),
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
      Effect.provide(BunFileSystem.layer),
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
      Effect.provide(BunFileSystem.layer),
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
      Effect.provide(BunFileSystem.layer),
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
        Effect.provide(BunFileSystem.layer),
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
        Effect.provide(BunFileSystem.layer),
        Effect.runPromise,
      ))
})

test.it("treats differently named filesystem catch-alls as the same runtime path", () =>
  Effect
    .gen(function*() {
      const result = yield* Effect.result(FileRouter.getFileRoutes([
        "docs/[[rest]]/route.ts",
        "docs/[[path]]/route.ts",
      ]))

      test
        .expect(result._tag)
        .toBe("Failure")

      if (result._tag === "Failure") {
        test
          .expect(result.failure.reason)
          .toBe("Conflict")
        test
          .expect(result.failure.path)
          .toBe("/docs/*")
      }
    })
    .pipe(Effect.runPromise))

test.it("converts empty file paths", () => {
  test
    .expect(FilePathPattern.toPathPattern(""))
    .toEqual(Result.succeed("/"))
  test
    .expect(FilePathPattern.toPathPattern("/"))
    .toEqual(Result.succeed("/"))
})

test.it("strips groups during conversion", () => {
  test
    .expect(FilePathPattern.toPathPattern("(admin)"))
    .toEqual(Result.succeed("/"))
  test
    .expect(FilePathPattern.toPathPattern("/(admin)/users"))
    .toEqual(
      Result.succeed("/users"),
    )
  test
    .expect(FilePathPattern.toPathPattern("(auth)/login/(step1)"))
    .toEqual(
      Result.succeed("/login"),
    )
})

test.it("converts params and rest segments", () => {
  test
    .expect(FilePathPattern.toPathPattern("users/[userId]/posts"))
    .toEqual(Result.succeed("/users/:userId/posts"))
  test
    .expect(FilePathPattern.toPathPattern("api/[[path]]"))
    .toEqual(
      Result.succeed("/api/*"),
    )
})

test.it("parseRoute extracts handle", () => {
  const route = FileRouter.parseRoute("users/route.tsx")

  test
    .expect(route)
    .not
    .toBeNull()
  test
    .expect(route!.handle)
    .toBe("route")
  test
    .expect(route!.routePath)
    .toBe("/users")

  const layer = FileRouter.parseRoute("api/layer.ts")

  test
    .expect(layer)
    .not
    .toBeNull()
  test
    .expect(layer!.handle)
    .toBe("layer")
  test
    .expect(layer!.routePath)
    .toBe("/api")
})

test.it("parseRoute with groups", () => {
  const route = FileRouter.parseRoute("(admin)/users/route.tsx")

  test
    .expect(route)
    .not
    .toBeNull()
  test
    .expect(route!.handle)
    .toBe("route")
  test
    .expect(route!.routePath)
    .toBe("/users")
})

test.it("parseRoute with params and rest", () => {
  const route = FileRouter.parseRoute("users/[userId]/posts/route.tsx")

  test
    .expect(route)
    .not
    .toBeNull()
  test
    .expect(route!.handle)
    .toBe("route")
  test
    .expect(route!.routePath)
    .toBe("/users/:userId/posts")

  const rest = FileRouter.parseRoute("api/[[path]]/route.ts")

  test
    .expect(rest)
    .not
    .toBeNull()
  test
    .expect(rest!.handle)
    .toBe("route")
  test
    .expect(rest!.routePath)
    .toBe("/api/*")
})

test.it("rejects invalid file path patterns", () => {
  test
    .expect(Result.isFailure(FilePathPattern.toPathPattern("$...")))
    .toBe(true)
  test
    .expect(Result.isFailure(FilePathPattern.toPathPattern("invalid%char")))
    .toBe(
      true,
    )
  test
    .expect(Result.isFailure(FilePathPattern.toPathPattern("foo/[[rest]]/bar")))
    .toBe(
      true,
    )
})

test.it("supports literal segments with dots", () => {
  test
    .expect(FilePathPattern.toPathPattern("events.json"))
    .toEqual(
      Result.succeed("/events.json"),
    )
})
