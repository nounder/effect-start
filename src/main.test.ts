import { HttpApp, HttpServerRequest } from "@effect/platform"
import { Console, Effect } from "effect"
import * as assert from "jsr:@std/assert"
import { Router } from "./main.ts"
import * as Vite from "./vite.ts"

Deno.test(
  "create vite dev server",
  () =>
    Effect.gen(function*() {
      const vite = yield* Vite.Vite

      assert.assert(vite, "vite layer didn't return anything")
    })
      .pipe(
        Effect.provide(Vite.ViteDev),
        Effect.tapError(Console.log),
        Effect.scoped,
        Effect.runPromise,
      ),
)

Deno.test(
  "send request",
  () =>
    Effect.gen(function*() {
      const handle = HttpApp.toWebHandler(Router)

      yield* Effect.tryPromise(async () => {
        const res = await handle(new Request("http://localhost:3000/"))

        console.log(res.headers, await res.text(), res.status)
      })
    })
      .pipe(
        Effect.provide(Vite.ViteDev),
        Effect.tapError(Console.log),
        Effect.scoped,
        Effect.runPromise,
      ),
)
