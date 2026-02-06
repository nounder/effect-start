type JsonPrimitives = string | number | boolean | null

export type JsonObject = {
  [key: string]:
    | Json
    // undefined won't be included in JSON objects but this will allow
    // to use Json type in functions that return object of multiple shapes
    | undefined
}

export type Json = JsonPrimitives | Json[] | JsonObject

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object") {
    return false
  }

  // Check for built-in types and web APIs
  if (
    ArrayBuffer.isView(value) ||
    value instanceof ArrayBuffer ||
    value instanceof Blob ||
    value instanceof FormData ||
    value instanceof URLSearchParams ||
    value instanceof ReadableStream ||
    value instanceof Date ||
    value instanceof Map ||
    value instanceof Set ||
    value instanceof RegExp ||
    value instanceof Error ||
    value instanceof Promise ||
    Array.isArray(value)
  ) {
    return false
  }

  // Check if it's a plain object (Object.prototype or null prototype)
  const proto = Object.getPrototypeOf(value)
  return proto === null || proto === Object.prototype
}

/**
 * Type helper that returns `true` if type T has any method properties,
 * otherwise returns `never`.
 *
 * Used internally by IsPlainObject to distinguish plain objects from
 * class instances or objects with methods.
 */
type HasMethod<T> = {
  [K in keyof T]: T[K] extends (...args: Array<any>) => any ? true : never
}[keyof T]

export type IsPlainObject<T> = T extends object
  ? T extends Function
    ? false
    : HasMethod<T> extends never
      ? true
      : false
  : false

export type Simplify<T> = {
  -readonly [K in keyof T]: IsPlainObject<T[K]> extends true
    ? { -readonly [P in keyof T[K]]: T[K][P] }
    : T[K]
} extends infer U
  ? { [K in keyof U]: U[K] }
  : never

export const concatBytes = (a: Uint8Array, b: Uint8Array): Uint8Array => {
  const result = new Uint8Array(a.byteLength + b.byteLength)
  result.set(a)
  result.set(b, a.byteLength)
  return result
}
