import { HttpServerResponse } from "@effect/platform"

export const renderHttpServerResponseError = (e: any) => {
  console.error(e)

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

  return HttpServerResponse.json({
    error: e?.["name"] || null,
    message: e.message,
    stack: stack,
  })
}
