import * as test from "bun:test"
import { MemoryFileSystem } from "effect-memfs"
import * as Effect from "effect/Effect"
import { effectFn } from "./testing"
import * as FileRouter from "./FileRouter.ts"

const Files = {
  "/routes/about/layer.tsx": "",
  "/routes/about/route.tsx": "",
  "/routes/users/route.tsx": "",
  "/routes/users/layer.tsx": "",
  "/routes/users/[userId]/route.tsx": "",
  "/routes/layer.tsx": "",
}

const effect = effectFn()

test.it("walks routes", () =>
  effect(function*() {
    const files = yield* FileRouter.walkRoutesDirectory("/routes").pipe(
      Effect.provide(MemoryFileSystem.layerWith(Files)),
    )

    test
      .expect(
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

test.it("walks routes with rest", () =>
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

    test
      .expect(
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
