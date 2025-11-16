import {
  expect,
  it,
} from "bun:test"
import { Effect } from "effect"
import { MemoryFileSystem } from "effect-memfs"
import * as FileRouter from "./FileRouter.ts"
import { effectFn } from "./testing.ts"

const Files = {
  "/routes/about/layer.tsx": "",
  "/routes/about/route.tsx": "",
  "/routes/users/route.tsx": "",
  "/routes/users/layer.tsx": "",
  "/routes/users/[userId]/route.tsx": "",
  "/routes/layer.tsx": "",
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
        "layer.tsx",
        "about/layer.tsx",
        "about/route.tsx",
        "users/layer.tsx",
        "users/route.tsx",
        "users/[userId]/route.tsx",
      ])
  }))

it("walks routes with rest", () =>
  effect(function*() {
    const files = yield* FileRouter.walkRoutesDirectory("/routes").pipe(
      Effect.provide(
        MemoryFileSystem.layerWith({
          ...Files,
          "/routes/[[...rest]]/route.tsx": "",
          "/routes/users/[...path]/route.tsx": "",
        }),
      ),
    )

    expect(
      files.map(v => v.modulePath),
    )
      .toEqual([
        "layer.tsx",
        "about/layer.tsx",
        "about/route.tsx",
        "users/layer.tsx",
        "users/route.tsx",
        "users/[userId]/route.tsx",
        "users/[...path]/route.tsx",
        "[[...rest]]/route.tsx",
      ])
  }))
