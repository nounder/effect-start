import * as Effect from "effect/Effect"
import * as Inspectable from "effect/Inspectable"
import * as Stream from "effect/Stream"
import * as Multipart from "../Multipart.ts"

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

export async function parseFormData(
  request: Request,
): Promise<
  Record<string, ReadonlyArray<Multipart.File | string> | string>
> {
  const formData = await request.formData()
  const result: Record<string, ReadonlyArray<Multipart.File | string> | string> = {}

  for (const key of new Set(formData.keys())) {
    const values = formData.getAll(key)
    if (values.every((value) => typeof value === "string")) {
      result[key] = values.length === 1 ? values[0] as string : values as Array<string>
      continue
    }

    result[key] = values.map((value) => {
      if (typeof value === "string") return value

      const contentType = value.type || "application/octet-stream"
      return {
        ...Inspectable.BaseProto,
        [Multipart.TypeId]: Multipart.TypeId,
        _tag: "File",
        key,
        name: value.name,
        contentType,
        content: Stream.fromReadableStream({
          evaluate: () => value.stream(),
          onError: (cause) => new Multipart.MultipartError({ reason: { _tag: "InternalError", cause } }),
        }),
        contentEffect: Effect.tryPromise({
          try: () => value.arrayBuffer().then((buffer) => new Uint8Array(buffer)),
          catch: (cause) => new Multipart.MultipartError({ reason: { _tag: "InternalError", cause } }),
        }),
        toJSON: () => ({
          _id: "effect-start/Multipart/File",
          key,
          name: value.name,
          contentType,
        }),
      } satisfies Multipart.File
    })
  }

  return result
}
