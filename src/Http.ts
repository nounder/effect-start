export type Method =
  | "GET"
  | "POST"
  | "PUT"
  | "DELETE"
  | "PATCH"
  | "HEAD"
  | "OPTIONS"

type Respondable =
  | Response
  | Promise<Response>

export type WebHandler = (request: Request) => Respondable

export type WebMiddleware = (
  request: Request,
  next: WebHandler,
) => Respondable

export function cloneRequest<T extends object>(
  request: Request,
  props: T,
): Request & T {
  const cloned = new Request(request.url, {
    method: request.method,
    headers: request.headers,
    body: request.body,
  })
  for (const [key, value] of Object.entries(props)) {
    ;(cloned as any)[key] = value
  }
  return cloned as Request & T
}

export function fetch(
  handler: WebHandler,
  init:
    & RequestInit
    & (
      | { url: string }
      | { path: `/${string}` }
    ),
): Promise<Response> {
  const url = "path" in init
    ? `http://localhost${init.path}`
    : init.url
  const request = new Request(url, init)
  return Promise.resolve(handler(request))
}

export function createAbortableRequest(
  init:
    & Omit<RequestInit, "signal">
    & (
      | { url: string }
      | { path: `/${string}` }
    ),
): { request: Request; abort: () => void } {
  const url = "path" in init
    ? `http://localhost${init.path}`
    : init.url
  const controller = new AbortController()
  const request = new Request(url, { ...init, signal: controller.signal })
  return { request, abort: () => controller.abort() }
}
