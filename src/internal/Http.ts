export type Method =
  | "GET"
  | "POST"
  | "PUT"
  | "DELETE"
  | "PATCH"
  | "HEAD"
  | "OPTIONS"

type Respondable = Response | Promise<Response>

export type WebHandler = (request: Request) => Respondable

export type WebMiddleware = (request: Request, next: WebHandler) => Respondable

export function createAbortableRequest(
  init:
    & Omit<RequestInit, "signal">
    & ({ url: string } | { path: `/${string}` }),
): { request: Request; abort: () => void } {
  const url = "path" in init ? `http://localhost${init.path}` : init.url
  const controller = new AbortController()
  const request = new Request(url, { ...init, signal: controller.signal })
  return { request, abort: () => controller.abort() }
}

export function mapHeaders(
  headers: Headers,
): Record<string, string | undefined> {
  const result: Record<string, string | undefined> = {}
  headers.forEach((value, key) => {
    result[key.toLowerCase()] = value
  })
  return result
}

export function parseCookies(
  cookieHeader: string | null,
): Record<string, string | undefined> {
  if (!cookieHeader) return {}
  const result: Record<string, string | undefined> = {}
  for (const part of cookieHeader.split(";")) {
    const idx = part.indexOf("=")
    if (idx === -1) {
      // Cookie without value (e.g., "name" or just whitespace)
      const key = part.trim()
      if (key) {
        result[key] = undefined
      }
    } else {
      const key = part.slice(0, idx).trim()
      const value = part.slice(idx + 1).trim()
      if (key) {
        result[key] = value
      }
    }
  }
  return result
}

export function mapUrlSearchParams(
  params: URLSearchParams,
): Record<string, string | ReadonlyArray<string> | undefined> {
  const result: Record<string, string | ReadonlyArray<string> | undefined> = {}
  for (const key of new Set(params.keys())) {
    const values = params.getAll(key)
    result[key] = values.length === 1 ? values[0] : values
  }
  return result
}
