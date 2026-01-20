export type Method =
  | "GET"
  | "POST"
  | "PUT"
  | "DELETE"
  | "PATCH"
  | "HEAD"
  | "OPTIONS"

export type WebHandler = (request: Request) => Response | Promise<Response>

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
