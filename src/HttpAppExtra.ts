import {
  HttpRouter,
  HttpServerRequest,
  HttpServerResponse,
} from "@effect/platform"
import * as HttpApp from "@effect/platform/HttpApp"
import * as HttpMiddleware from "@effect/platform/HttpMiddleware"

import {
  RequestError,
  RouteNotFound,
} from "@effect/platform/HttpServerError"
import {
  Cause,
  Effect,
  Option,
  ParseResult,
  Record,
} from "effect"

/**
 * Groups: function, path
 */
const StackLinePattern = /^at (.*?) \((.*?)\)/

type GraciousError =
  | RouteNotFound
  | ParseResult.ParseError
  | RequestError
  | ParseResult.ParseError

function errorHtml(
  status: number,
  tag: string,
  details?: object,
): HttpServerResponse.HttpServerResponse {
  const detailsHtml = details
    ? `<pre>${JSON.stringify(details, null, 2)}</pre>`
    : ""
  const html = `<!DOCTYPE html>
<html>
<head>
  <title>Error ${status}</title>
  <style>
    body { font-family: system-ui, sans-serif; padding: 2rem; max-width: 600px; margin: 0 auto; }
    .error { background: #fee; border: 1px solid #c00; padding: 1rem; border-radius: 4px; }
    .tag { font-weight: bold; color: #c00; }
    pre { background: #f5f5f5; padding: 1rem; overflow-x: auto; }
  </style>
</head>
<body>
  <div class="error">
    <p class="tag">${tag}</p>
    ${detailsHtml}
  </div>
</body>
</html>`
  return HttpServerResponse.text(html, { status, contentType: "text/html" })
}

function errorText(
  status: number,
  tag: string,
  details?: object,
): HttpServerResponse.HttpServerResponse {
  const text = details ? `${tag}\n${JSON.stringify(details, null, 2)}` : tag
  return HttpServerResponse.text(text, { status })
}

function respondWithError(
  accept: string,
  status: number,
  tag: string,
  details?: object,
): HttpServerResponse.HttpServerResponse {
  if (accept.includes("text/html")) {
    return errorHtml(status, tag, details)
  }
  if (accept.includes("text/plain")) {
    return errorText(status, tag, details)
  }
  return HttpServerResponse.unsafeJson(
    { error: { _tag: tag, ...details } },
    { status },
  )
}

export const renderError = (
  error: unknown,
  accept: string = "",
) =>
  Effect.gen(function*() {
    let unwrappedError: GraciousError | undefined

    if (Cause.isCause(error)) {
      const failure = Cause.failureOption(error).pipe(Option.getOrUndefined)

      if (failure?.["_tag"]) {
        unwrappedError = failure as GraciousError
      }

      yield* Effect.logError(error)
    }

    switch (unwrappedError?._tag) {
      case "RouteNotFound":
        return respondWithError(accept, 404, "RouteNotFound")
      case "RequestError": {
        const message = unwrappedError.reason === "Decode"
          ? "Request body is invalid"
          : undefined

        return respondWithError(accept, 400, "RequestError", {
          reason: unwrappedError.reason,
          message,
        })
      }
      case "ParseError": {
        const issues = yield* ParseResult.ArrayFormatter.formatIssue(
          unwrappedError.issue,
        )
        const cleanIssues = issues.map(v => Record.remove(v, "_tag"))

        return respondWithError(accept, 400, "ParseError", {
          issues: cleanIssues,
        })
      }
    }

    if (Cause.isCause(error)) {
      const defects = [...Cause.defects(error)]
      const defect = defects[0]
      if (defect instanceof Error) {
        return respondWithError(accept, 500, "UnexpectedError", {
          name: defect.name,
          message: defect.message,
          stack: extractPrettyStack(defect.stack ?? ""),
        })
      }
    }

    return respondWithError(accept, 500, "UnexpectedError")
  })

function extractPrettyStack(stack: string) {
  return stack
    .split("\n")
    .slice(1)
    .map((line) => {
      const match = line.trim().match(StackLinePattern)

      if (!match) return line

      const [_, fn, path] = match
      const relativePath = path.replace(process.cwd(), ".")
      return [fn, relativePath]
    })
    .filter(Boolean)
}

export function handleErrors<
  E,
  R,
>(
  app: HttpApp.Default<E, R>,
): HttpApp.Default<
  Exclude<E, RouteNotFound>,
  R | HttpServerRequest.HttpServerRequest
> {
  return Effect.gen(function*() {
    const request = yield* HttpServerRequest.HttpServerRequest
    const accept = request.headers.accept ?? ""
    return yield* app.pipe(
      Effect.catchAllCause((cause) => renderError(cause, accept)),
    )
  })
}

export const withErrorHandled = HttpMiddleware.make(app =>
  Effect.gen(function*() {
    const request = yield* HttpServerRequest.HttpServerRequest
    const accept = request.headers.accept ?? ""
    return yield* app.pipe(
      Effect.catchAllCause((cause) => renderError(cause, accept)),
    )
  })
)
