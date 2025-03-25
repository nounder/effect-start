import { FileSystem, HttpApp, HttpServerResponse } from "@effect/platform"
import type { PlatformError } from "@effect/platform/Error"
import { Array, Data, Effect, pipe, Stream } from "effect"
import { constVoid } from "effect/Function"

type Config = {
  path: string
  readConcurrency?: number
  filenamePattern?: RegExp
  css?: string
}

class TailwindError extends Data.TaggedError("TailwindError")<{
  message: string
  config: Config
}> {}

export const extractCandidates = (config: Config) =>
  Effect.gen(function*() {
    const {
      readConcurrency = 32,
      filenamePattern = /\.(tsx|jsx|html)$/,
    } = config

    const fs = yield* FileSystem.FileSystem
    const candidateSet = pipe(
      fs.readDirectory(config.path, { recursive: true }),
      Effect.andThen(Array.filter((f) => filenamePattern.test(f))),
      Stream.fromIterableEffect,
      Stream.mapEffect((f) => fs.readFileString(f), {
        concurrency: readConcurrency,
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
    const {
      css: inputCss = `@import "tailwindcss"`,
    } = config
    const candidateSet = yield* extractCandidates(config)

    const twCompiler = yield* Effect.tryPromise({
      try: () =>
        import("@tailwindcss/node").then((tw) =>
          tw.compile(inputCss, {
            base: process.cwd(),
            onDependency: constVoid,
          })
        ),
      catch: (e) =>
        new TailwindError({
          message: String(e),
          config,
        }),
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
