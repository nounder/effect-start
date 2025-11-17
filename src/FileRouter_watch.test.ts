import { FileSystem } from "@effect/platform"
import * as t from "bun:test"
import { Effect } from "effect"
import { MemoryFileSystem } from "effect-memfs"
import * as FileRouterCodegen from "./FileRouterCodegen.ts"

t.it("update() > regenerates manifest when files are added", () =>
  Effect
    .gen(function*() {
      const fs = yield* FileSystem.FileSystem

      // Initial state with one route
      yield* FileRouterCodegen.update("/routes")

      let content = yield* fs.readFileString("/routes/_manifest.ts")

      t.expect(content)
        .toContain('path: "/"')

      t.expect(content)
        .not.toContain("about")

      // Add a new route
      yield* fs.makeDirectory("/routes/about", { recursive: true })
      yield* fs.writeFileString("/routes/about/route.tsx", "")
      yield* FileRouterCodegen.update("/routes")

      content = yield* fs.readFileString("/routes/_manifest.ts")

      t.expect(content)
        .toContain('path: "/"')

      t.expect(content)
        .toContain('path: "/about"')
    })
    .pipe(
      Effect.provide(
        MemoryFileSystem.layerWith({
          "/routes/route.tsx": "",
          "/routes/_manifest.ts": "",
        }),
      ),
      Effect.runPromise,
    ))

t.it("update() > regenerates manifest when files are deleted", () =>
  Effect
    .gen(function*() {
      const fs = yield* FileSystem.FileSystem

      // Initial state with two routes
      yield* FileRouterCodegen.update("/routes")

      let content = yield* fs.readFileString("/routes/_manifest.ts")

      t.expect(content)
        .toContain('path: "/"')

      t.expect(content)
        .toContain('path: "/about"')

      // Delete the about route
      yield* fs.remove("/routes/about/route.tsx")
      yield* FileRouterCodegen.update("/routes")

      content = yield* fs.readFileString("/routes/_manifest.ts")

      t.expect(content)
        .toContain('path: "/"')

      t.expect(content)
        .not.toContain("about")
    })
    .pipe(
      Effect.provide(
        MemoryFileSystem.layerWith({
          "/routes/route.tsx": "",
          "/routes/about/route.tsx": "",
          "/routes/_manifest.ts": "",
        }),
      ),
      Effect.runPromise,
    ))

t.it("update() > regenerates manifest when directory with routes is deleted", () =>
  Effect
    .gen(function*() {
      const fs = yield* FileSystem.FileSystem

      // Initial state with nested routes
      yield* FileRouterCodegen.update("/routes")

      let content = yield* fs.readFileString("/routes/_manifest.ts")

      t.expect(content)
        .toContain('path: "/"')

      t.expect(content)
        .toContain('path: "/about"')

      // Delete the entire about directory
      yield* fs.remove("/routes/about", { recursive: true })
      yield* FileRouterCodegen.update("/routes")

      content = yield* fs.readFileString("/routes/_manifest.ts")

      t.expect(content)
        .toContain('path: "/"')

      t.expect(content)
        .not.toContain("about")
    })
    .pipe(
      Effect.provide(
        MemoryFileSystem.layerWith({
          "/routes/route.tsx": "",
          "/routes/about/route.tsx": "",
          "/routes/_manifest.ts": "",
        }),
      ),
      Effect.runPromise,
    ))

