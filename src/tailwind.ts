import { Array as Arr, Effect, Stream } from "effect"
import * as tw from "@tailwindcss/node"
import * as stdFs from "jsr:@std/fs"
import {
  FileSystem,
  HttpClientResponse,
  HttpServerResponse,
} from "@effect/platform"
import { constVoid, pipe } from "effect/Function"

// TODO: how about etags and caching?
export const TailwidCssRoute = Effect.gen(function* () {
  const candidateSet = yield* pipe(
    Stream.fromAsyncIterable(
      stdFs.expandGlob("src/**/*.tsx", {
        includeDirs: false,
        followSymlinks: true,
      }),
      (e: any) => new Error(e?.message || e),
    ),
    Stream.mapEffect(
      (f) => Effect.tryPromise(() => Deno.readTextFile(f.path)),
      {
        concurrency: 20,
      },
    ),
    Stream.map(extractClassNames),
    Stream.runFold(
      new Set<string>(),
      (a, v) => {
        v.forEach((v) => a.add(v))
        return a
      },
    ),
  )

  const inputCss = [
    `@import "tailwindcss";`,
  ].join("\n")

  const twCompiler = yield* Effect.tryPromise(() =>
    tw.compile(inputCss, {
      base: Deno.cwd(),
      onDependency: constVoid,
    })
  )

  const outputCss = twCompiler.build(Array.from(candidateSet))

  return HttpServerResponse.text(outputCss, {
    headers: {
      // todo
      "content-type": "text/css",
    },
  })
})

function extractClassNames(source: string): string[] {
  const classNames = new Set()

  // Match class attributes
  const classRegex = /class=["']([^"']+)["']/g
  let match
  while ((match = classRegex.exec(source)) !== null) {
    const classes = match[1].split(/\s+/)
    classes.forEach((className) => classNames.add(className))
  }

  // Match classList objects
  const classListRegex = /classList=\{\s*\{([^}]+)\}\s*\}/g
  while ((match = classListRegex.exec(source)) !== null) {
    const classListContent = match[1]
    const objectKeysRegex = /(\w+):/g
    let keyMatch
    while ((keyMatch = objectKeysRegex.exec(classListContent)) !== null) {
      classNames.add(keyMatch[1])
    }
  }

  return Array.from(classNames)
}
