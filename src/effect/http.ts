import { HttpServerResponse } from "@effect/platform"
import { Console, Effect, Logger } from "effect"

export const handleHttpServerResponseError = (e: any) =>
  Effect.gen(function*() {
    yield* Effect.logError(e)

    const stack = e["stack"]
      ?.split("\n")
      .slice(1)
      ?.map((line) => {
        const match = line.trim().match(/^at (.*?) \((.*?)\)/)

        if (!match) return line

        const [_, fn, path] = match
        const relativePath = path.replace(process.cwd(), ".")
        return [fn, relativePath]
      })
      .filter(Boolean)

    return yield* HttpServerResponse.json({
      error: e?.["name"] || null,
      message: e.message,
      stack: stack,
    })
  })
