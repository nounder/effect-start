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

type StackFrame = {
  function: string
  file: string
  type: "application" | "framework" | "node_modules"
}

const ERROR_PAGE_CSS = `
  :root {
    --error-red: #c00;
    --error-red-dark: #a00;
    --bg-error: #fee;
    --bg-light: #f5f5f5;
    --bg-white: #fff;
    --border-color: #ddd;
    --text-dark: #333;
    --text-gray: #666;
    --text-mono: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  }

  * { box-sizing: border-box; }

  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
    margin: 0;
    padding: 0;
    color: var(--text-dark);
    line-height: 1.6;
    min-height: 100dvh;
  }

  .error-page { width: 100%; margin: 0; }

  .error-header {
    background: var(--error-red);
    color: white;
    padding: 2rem 2.5rem;
    margin: 0;
    font-family: var(--text-mono);
  }

  .error-header h1 {
    margin: 0 0 0.5rem 0;
    font-size: 2rem;
    font-weight: 600;
    font-family: var(--text-mono);
  }

  .error-message {
    margin: 0;
    font-size: 1.1rem;
    opacity: 0.95;
    font-family: var(--text-mono);
  }

  .error-content {
    background: var(--bg-white);
    padding: 2rem 2.5rem;
  }

  .stack-trace {
    margin: 1.5rem 0;
    border: 1px solid var(--border-color);
    border-radius: 4px;
    overflow: hidden;
  }

  .stack-trace-header {
    font-weight: 600;
    padding: 0.75rem 1rem;
    background: var(--bg-light);
    border-bottom: 1px solid var(--border-color);
  }

  .stack-list {
    list-style: none;
    padding: 0;
    margin: 0;
    max-height: 400px;
    overflow-y: auto;
  }

  .stack-list li {
    padding: 0.5rem 1rem;
    font-family: var(--text-mono);
    font-size: 0.875rem;
    border-bottom: 1px solid var(--border-color);
    background: var(--bg-white);
  }

  .stack-list li:last-child { border-bottom: none; }

  .stack-list li:hover { background: #fafafa; }

  .stack-list code {
    background: transparent;
    padding: 0;
    font-weight: 600;
    color: var(--error-red-dark);
  }

  .stack-list .path { color: var(--text-gray); margin-left: 0.5rem; }

  .request-info {
    margin: 1.5rem 0;
    border: 1px solid var(--border-color);
    border-radius: 4px;
    overflow: hidden;
  }

  .request-info-header {
    font-weight: 700;
    padding: 0.75rem 1rem;
    background: var(--bg-light);
    border-bottom: 1px solid var(--border-color);
  }

  .request-info-content {
    padding: 1rem;
    font-family: var(--text-mono);
    font-size: 0.875rem;
    white-space: pre-wrap;
    word-break: break-all;
  }

  @media (max-width: 768px) {
    .error-header, .error-content { padding: 1.5rem 1rem; }
    .error-header h1 { font-size: 1.5rem; }
  }
`

type ErrorHtmlData = {
  status: number
  tag: string
  message?: string
  details?: object
  requestContext?: RequestContext
  errorName?: string
}

function errorHtml(data: ErrorHtmlData): HttpServerResponse.HttpServerResponse {
  let detailsHtml = ""

  if (data.details) {
    const detailsObj = data.details as Record<string, unknown>

    if ("stack" in detailsObj && Array.isArray(detailsObj.stack)) {
      const stackFrames = detailsObj.stack as StackFrame[]
      detailsHtml = renderStackTrace(stackFrames)
    }
  }

  const requestHtml = data.requestContext
    ? renderRequestContext(data.requestContext)
    : ""

  const messageHtml = data.message
    ? `<p class="error-message">${escapeHtml(data.message)}</p>`
    : ""

  const headerTitle = data.errorName ?? "UnexpectedError"

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${headerTitle} - Error ${data.status}</title>
  <style>${ERROR_PAGE_CSS}</style>
</head>
<body>
  <div class="error-header">
    <h1>${escapeHtml(headerTitle)}</h1>
    ${messageHtml}
  </div>
  <div class="error-content">
    ${detailsHtml}
    ${requestHtml}
  </div>
</body>
</html>`
  return HttpServerResponse.text(html, {
    status: data.status,
    contentType: "text/html",
  })
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
  message?: string,
  details?: object,
  requestContext?: RequestContext,
  errorName?: string,
): HttpServerResponse.HttpServerResponse {
  if (accept.includes("text/html")) {
    return errorHtml({
      status,
      tag,
      message,
      details,
      requestContext,
      errorName,
    })
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
    const request = yield* HttpServerRequest.HttpServerRequest

    const requestContext: RequestContext = {
      url: request.url,
      method: request.method,
      headers: filterSensitiveHeaders(request.headers),
    }

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
        return respondWithError(
          accept,
          404,
          "RouteNotFound",
          "The page you were looking for doesn't exist",
          undefined,
          requestContext,
        )
      case "RequestError": {
        const message = unwrappedError.reason === "Decode"
          ? "Request body is invalid"
          : "Request could not be processed"

        return respondWithError(
          accept,
          400,
          "RequestError",
          message,
          {
            reason: unwrappedError.reason,
          },
          requestContext,
        )
      }
      case "ParseError": {
        const issues = yield* ParseResult.ArrayFormatter.formatIssue(
          unwrappedError.issue,
        )
        const cleanIssues = issues.map((v) => Record.remove(v, "_tag"))

        return respondWithError(
          accept,
          400,
          "ParseError",
          "Validation failed",
          {
            issues: cleanIssues,
          },
          requestContext,
        )
      }
    }

    if (Cause.isCause(error)) {
      const defects = [...Cause.defects(error)]
      const defect = defects[0]
      if (defect instanceof Error) {
        const stackFrames = extractPrettyStack(defect.stack ?? "")
        return respondWithError(
          accept,
          500,
          "UnexpectedError",
          defect.message,
          {
            name: defect.name,
            stack: stackFrames,
          },
          requestContext,
          defect.name,
        )
      }
    }

    return respondWithError(
      accept,
      500,
      "UnexpectedError",
      "An unexpected error occurred",
      undefined,
      requestContext,
      "UnexpectedError",
    )
  })

function parseStackFrame(line: string): StackFrame | null {
  const match = line.trim().match(StackLinePattern)
  if (!match) return null

  const [_, fn, fullPath] = match
  const relativePath = fullPath.replace(process.cwd(), ".")

  let type: "application" | "framework" | "node_modules"
  if (relativePath.includes("node_modules")) {
    type = "node_modules"
  } else if (
    relativePath.startsWith("./src")
    || relativePath.startsWith("./examples")
  ) {
    type = "application"
  } else {
    type = "framework"
  }

  return {
    function: fn,
    file: relativePath,
    type,
  }
}

function extractPrettyStack(stack: string): StackFrame[] {
  return stack
    .split("\n")
    .slice(1)
    .map(parseStackFrame)
    .filter((frame): frame is StackFrame => frame !== null)
}

function renderStackFrames(frames: StackFrame[]): string {
  if (frames.length === 0) {
    return "<li>No stack frames</li>"
  }
  return frames
    .map(
      (f) =>
        `<li><code>${f.function}</code> at <span class="path">${f.file}</span></li>`,
    )
    .join("")
}

function renderStackTrace(frames: StackFrame[]): string {
  return `
    <div class="stack-trace">
      <div class="stack-trace-header">Stack Trace (${frames.length})</div>
      <ul class="stack-list">${renderStackFrames(frames)}</ul>
    </div>
  `
}

function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
}

function filterSensitiveHeaders(
  headers: Record<string, string>,
): Record<string, string> {
  const sensitive = ["authorization", "cookie", "x-api-key"]
  return Object.fromEntries(
    Object.entries(headers).filter(
      ([key]) => !sensitive.includes(key.toLowerCase()),
    ),
  )
}

type RequestContext = {
  url: string
  method: string
  headers: Record<string, string>
}

function renderRequestContext(context: RequestContext): string {
  const headersText = Object
    .entries(context.headers)
    .map(([key, value]) => `${key}: ${value}`)
    .join("\n")

  const requestText = `${context.method} ${context.url}\n${headersText}`

  return `
    <div class="request-info">
      <div class="request-info-header">Request</div>
      <div class="request-info-content">${escapeHtml(requestText)}</div>
    </div>
  `
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
