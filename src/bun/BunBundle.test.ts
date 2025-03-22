import { fileURLToPath } from "bun"
import { expect, it } from "bun:test"
import { Chunk } from "effect"
import * as TestHttpClient from "../effect/TestHttpClient.ts"
import { effectFn } from "../test.ts"
import * as BunBundle from "./BunBundle.ts"

const effect = effectFn()

it("build router", () =>
  effect(function*() {
    const router = yield* BunBundle.buildRouter({
      entrypoints: [
        fileURLToPath(import.meta.resolve("./BunBundle.test.ts")),
      ],
      naming: "[name]-[hash].[ext]",
      target: "bun",
    })

    const client = TestHttpClient.make(router)

    expect(Chunk.size(router.routes))
      .toEqual(1)

    const route = Chunk.unsafeGet(router.routes, 0)

    expect(route.path)
      .toMatch(/BunBundle\.test-[a-z0-9]+.js/)

    const res = yield* client.get(route.path)

    expect(res.status)
      .toEqual(200)

    expect(res.headers)
      .toMatchObject({
        "content-length": (yield* res.arrayBuffer).byteLength.toString(),
        "content-type": "text/javascript;charset=utf-8",
      })
  }))
