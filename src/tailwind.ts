import { FileSystem, HttpServerResponse } from "@effect/platform"
import { Array, Effect, Stream } from "effect"
import { constVoid, pipe } from "effect/Function"
import process from "node:process"

// TODO: how about etags and caching?
export const TailwidCssRoute = Effect.gen(function*() {
  const fs = yield* FileSystem.FileSystem
  const candidateSet = yield* pipe(
    fs.readDirectory("src/", { recursive: true }),
    Effect.andThen(Array.filter((f) => /\.tsx$/.test(f))),
    Stream.fromIterableEffect,
    Stream.mapEffect(
      (f) => fs.readFileString(f),
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
    import("@tailwindcss/node").then((tw) =>
      tw.compile(inputCss, {
        base: process.cwd(),
        onDependency: constVoid,
      })
    )
  )

  const outputCss = twCompiler.build(Array.fromIterable(candidateSet))

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
