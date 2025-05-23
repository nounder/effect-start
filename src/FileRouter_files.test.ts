import { FileSystem } from "@effect/platform"
import { expect, it, test } from "bun:test"
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
    console.log("walking")
    const fs = yield* FileSystem.FileSystem
    const files = yield* FileRouter.walkRoutes("/routes")

    expect(files).toEqual([
      "/routes/layout.tsx",
      "/routes/about/layout.tsx",
      "/routes/about/page.tsx",
      "/routes/users/layout.tsx",
      "/routes/users/page.tsx",
      "/routes/users/[userId]/page.tsx",
    ])
  }))
