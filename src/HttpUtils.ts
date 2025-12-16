import * as HttpServerRequest from "@effect/platform/HttpServerRequest"

export type FetchHandler = (request: Request) => Promise<Response>

export function makeUrlFromRequest(
  request: HttpServerRequest.HttpServerRequest,
): URL {
  const origin = request.headers.origin
    ?? request.headers.host
    ?? "http://localhost"
  const protocol = request.headers["x-forwarded-proto"] ?? "http"
  const host = request.headers.host ?? "localhost"
  const base = origin.startsWith("http")
    ? origin
    : `${protocol}://${host}`
  return new URL(request.url, base)
}
