import { HttpRouter, HttpServerResponse } from "@effect/platform"
import { Effect } from "effect"
import process from "node:process"
import LiveReloadHttpRoute from "./LiveReloadHttpRoute.ts"
import { TailwidCssRoute } from "./tailwind.ts"

export default HttpRouter.empty.pipe(
  HttpRouter.get("/yo", HttpServerResponse.text("yo")),
  HttpRouter.get(
    "/error",
    Effect.gen(function*() {
      yield* Effect.fail(new Error("custom error"))

      return HttpServerResponse.text("this will never be reached")
    }),
  ),
  HttpRouter.get("/.bundle/events", LiveReloadHttpRoute),
  HttpRouter.get("/.bundle/app.css", TailwidCssRoute),
  // HttpRouter.all("*", FrontendRoute),
  HttpRouter.catchAll(e => {
    console.error(e)

    const stack = e["stack"]
      ?.split("\n")
      .slice(1)
      ?.map(line => {
        const match = line.trim().match(/^at (.*?) \((.*?)\)/)

        if (!match) return line

        const [_, fn, path] = match
        const relativePath = path.replace(process.cwd(), ".")
        return [fn, relativePath]
        return `${fn} (${relativePath})`
      })
      .filter(Boolean)

    return HttpServerResponse.json({
      error: e?.["name"] || null,
      message: e.message,
      stack: stack,
    })
  }),
)
