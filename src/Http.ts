import * as Values from "./Values.ts"

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

export function fetch(
  handler: WebHandler,
  init:
    & Omit<RequestInit, "body">
    & (
      | { url: string }
      | { path: `/${string}` }
    )
    & { body?: RequestInit["body"] | Record<string, unknown> },
): Promise<Response> {
  const url = "path" in init
    ? `http://localhost${init.path}`
    : init.url

  const isPlain = Values.isPlainObject(init.body)

  const headers = new Headers(init.headers)
  if (isPlain && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json")
  }

  const body = isPlain ? JSON.stringify(init.body) : init.body

  const request = new Request(url, {
    ...init,
    headers,
    body: body as BodyInit,
  })
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

export interface FilePart {
  readonly _tag: "File"
  readonly key: string
  readonly name: string
  readonly contentType: string
  readonly content: Uint8Array
}

export interface FieldPart {
  readonly _tag: "Field"
  readonly key: string
  readonly value: string
}

export type MultipartPart = FilePart | FieldPart

export async function parseFormData(
  request: Request,
): Promise<
  Record<string, ReadonlyArray<FilePart> | ReadonlyArray<string> | string>
> {
  const formData = await request.formData()
  const result: Record<
    string,
    ReadonlyArray<FilePart> | ReadonlyArray<string> | string
  > = {}

  for (const key of new Set(formData.keys())) {
    const values = formData.getAll(key)
    const first = values[0]

    if (typeof first === "string") {
      result[key] = values.length === 1 ? first : (values as string[])
    } else {
      const files: FilePart[] = []
      for (const value of values) {
        if (typeof value !== "string") {
          const content = new Uint8Array(await value.arrayBuffer())
          files.push({
            _tag: "File",
            key,
            name: value.name,
            contentType: value.type || "application/octet-stream",
            content,
          })
        }
      }
      result[key] = files
    }
  }

  return result
}
