import {
  expect,
  it,
} from "bun:test"
import { Effect } from "effect"
import { MemoryFileSystem } from "effect-memfs"
import * as FileRouter from "./FileRouter.ts"
import { effectFn } from "./testing.ts"

const Files = {
  "/routes/about/_layout.tsx": "",
  "/routes/about/_page.tsx": "",
  "/routes/users/_page.tsx": "",
  "/routes/users/_layout.tsx": "",
  "/routes/users/$userId/_page.tsx": "",
  "/routes/_layout.tsx": "",
}

const effect = effectFn()

it("walks routes", () =>
  effect(function*() {
    const files = yield* FileRouter.walkRoutesDirectory("/routes").pipe(
      Effect.provide(MemoryFileSystem.layerWith(Files)),
    )

    expect(
      files.map(v => v.modulePath),
    )
      .toEqual([
        "_layout.tsx",
        "about/_layout.tsx",
        "about/_page.tsx",
        "users/_layout.tsx",
        "users/_page.tsx",
        "users/$userId/_page.tsx",
      ])
  }))

it("walks routes with splat", () =>
  effect(function*() {
    const files = yield* FileRouter.walkRoutesDirectory("/routes").pipe(
      Effect.provide(
        MemoryFileSystem.layerWith({
          ...Files,
          "/routes/$/_page.tsx": "",
          "/routes/users/$/_page.tsx": "",
        }),
      ),
    )

    expect(
      files.map(v => v.modulePath),
    )
      .toEqual([
        "_layout.tsx",
        "about/_layout.tsx",
        "about/_page.tsx",
        "users/_layout.tsx",
        "users/_page.tsx",
        "users/$userId/_page.tsx",
        "users/$/_page.tsx",
        "$/_page.tsx",
      ])
  }))
