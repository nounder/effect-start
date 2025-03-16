import { FileSystem, HttpApp, HttpServerResponse } from "@effect/platform"
import type { PlatformError } from "@effect/platform/Error"
import { Array, Effect, pipe, Stream } from "effect"
import { constVoid } from "effect/Function"

type Config = {
  readonly path: string
}

class TailwindError {
  readonly _tag = "TailwindError"

  constructor(
    readonly message: string,
    readonly config: Config,
  ) {}
}

export const extractCandidates = (config: Config) =>
  Effect.gen(function*() {
    const fs = yield* FileSystem.FileSystem
    const candidateSet = pipe(
      fs.readDirectory(config.path, { recursive: true }),
      Effect.andThen(Array.filter((f) => /\.tsx$/.test(f))),
      Stream.fromIterableEffect,
      Stream.mapEffect((f) => fs.readFileString(f), {
        concurrency: 20,
      }),
      Stream.map(extractClassNames),
      Stream.runFold(new Set<string>(), (a, v) => {
        v.forEach((v) => a.add(v))
        return a
      }),
    )

    return yield* candidateSet
  })

export const renderCss = (config: Config) =>
  Effect.gen(function*() {
    const candidateSet = yield* extractCandidates(config)
    const inputCss = [`@import "tailwindcss";`].join("\n")

    const twCompiler = yield* Effect.tryPromise({
      try: () =>
        import("@tailwindcss/node").then((tw) =>
          tw.compile(inputCss, {
            base: process.cwd(),
            onDependency: constVoid,
          })
        ),
      catch: (e) => new TailwindError(String(e), config),
    })

    const outputCss = twCompiler.build(Array.fromIterable(candidateSet))

    return outputCss
  })

export const toHttpApp = (
  config: Config,
): HttpApp.Default<PlatformError | TailwindError, FileSystem.FileSystem> =>
  pipe(
    renderCss(config),
    Effect.andThen((css) =>
      HttpServerResponse.text(css, {
        headers: {
          // todo
          "content-type": "text/css",
        },
      })
    ),
  )

function extractClassNames(source: string): string[] {
  const classNames = new Set<string>()

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

  return Array.fromIterable(classNames)
}
