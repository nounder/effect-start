import { Effect } from "effect"
import * as tw from "@tailwindcss/node"
import * as fs from "jsr:@std/fs"
import { HttpClientResponse, HttpServerResponse } from "@effect/platform"
import { constVoid } from "effect/Function"

class TailwindError extends Error {}

// TODO: how about etags and caching?
export const TailwidCssRoute = Effect.gen(function* () {
  const files = await Array.fromAsync(fs.expandGlob("src/**/*.tsx"))
  const canidates = files.map((v) => v.path)

  const inputCss = [
    `@import "tailwindcss";`,
  ].join("\n")

  const twCompiler = yield* Effect.tryPromise({
    try: () =>
      tw.compile(inputCss, {
        base: Deno.cwd(),
        onDependency: constVoid,
      }),
    // todo: properly effectify error
    catch: (e) => new TailwindError(e.message),
  })

  const outputCss = yield* Effect.tryPromise({
    try: () => twCompiler.build(canidates),
    catch: (e) => new TailwindError(e.message),
  })

  return HttpServerResponse.text(outputCss, {
    headers: {
      // todo
      "content-type": "",
    },
  })
})
