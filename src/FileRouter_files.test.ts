import { expect, it } from "bun:test"
import { MemoryFileSystem } from "effect-memfs"
import * as FileRouter from "./FileRouter.ts"
import { effectFn } from "./testing.ts"

const Files = {
  "/routes/about/layout.tsx": "",
  "/routes/about/page.tsx": "",
  "/routes/users/page.tsx": "",
  "/routes/users/layout.tsx": "",
  "/routes/users/[userId]/page.tsx": "",
  "/routes/layout.tsx": "",
}

const effect = effectFn(
  MemoryFileSystem.layerWith(Files),
)

it("walks routes", () =>
  effect(function*() {
    const files = yield* FileRouter.walkRoutes("/routes")

    expect(files.map(v => v.path)).toEqual([
      "layout.tsx",
      "about/layout.tsx",
      "about/page.tsx",
      "users/layout.tsx",
      "users/page.tsx",
      "users/[userId]/page.tsx",
    ])
  }))
