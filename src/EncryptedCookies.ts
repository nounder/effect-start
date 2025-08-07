import { Cookies, HttpApp, HttpServerResponse } from "@effect/platform"
import { Effect, pipe } from "effect"
import * as Config from "effect/Config"
import * as Context from "effect/Context"
import * as Data from "effect/Data"
import * as Layer from "effect/Layer"

type CookieValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | {
    [key: string]:
      | CookieValue
      // some libraries, like XState, contain unknown in type
      // that is serializable
      | unknown
  }
  | CookieValue[]

export class EncryptedCookiesError
  extends Data.TaggedError("EncryptedCookiesError")<{
    cause: unknown
    cookie?: Cookies.Cookie
  }>
{}

export class EncryptedCookies extends Context.Tag("EncryptedCookies")<
  EncryptedCookies,
  {
    encrypt: (
      value: CookieValue,
    ) => Effect.Effect<string, EncryptedCookiesError>
    decrypt: (
      encryptedValue: string,
    ) => Effect.Effect<CookieValue, EncryptedCookiesError>
    encryptCookie: (
      cookie: Cookies.Cookie,
    ) => Effect.Effect<Cookies.Cookie, EncryptedCookiesError>
    decryptCookie: (
      cookie: Cookies.Cookie,
    ) => Effect.Effect<Cookies.Cookie, EncryptedCookiesError>
  }
>() {}

export function layer(options: { secret: string }) {
  return Layer.effect(
    EncryptedCookies,
    Effect.gen(function*() {
      const keyMaterial = yield* deriveKeyMaterial(options.secret)

      // Pre-derive both keys once
      const encryptKey = yield* deriveKey(keyMaterial, ["encrypt"])
      const decryptKey = yield* deriveKey(keyMaterial, ["decrypt"])

      return EncryptedCookies.of({
        encrypt: (value: CookieValue) =>
          encryptWithDerivedKey(value, encryptKey),
        decrypt: (encryptedValue: string) =>
          decryptWithDerivedKey(encryptedValue, decryptKey),
        encryptCookie: (cookie: Cookies.Cookie) =>
          encryptCookieWithDerivedKey(cookie, encryptKey),
        decryptCookie: (cookie: Cookies.Cookie) =>
          decryptCookieWithDerivedKey(cookie, decryptKey),
      })
    }),
  )
}

export function layerConfig(name = "SECRET_KEY_BASE") {
  return Effect
    .gen(function*() {
      const secret = yield* pipe(
        Config.nonEmptyString(name),
        Effect.flatMap((value) => {
          return (value.length < 40)
            ? Effect.fail(new Error("ba"))
            : Effect.succeed(value)
        }),
        Effect.catchAll((err) => {
          return Effect.dieMessage(
            "SECRET_KEY_BASE must be at least 40 characters",
          )
        }),
      )

      return layer({ secret })
    })
    .pipe(Layer.unwrapEffect)
}

function encodeToBase64Segments(
  ciphertext: Uint8Array,
  iv: Uint8Array,
  authTag: Uint8Array,
): string {
  return [
    base64urlEncode(ciphertext),
    base64urlEncode(iv),
    base64urlEncode(authTag),
  ]
    .join(".")
}

function base64urlEncode(data: Uint8Array): string {
  const base64 = btoa(String.fromCharCode(...data))
  return base64
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "")
}

function decodeFromBase64Segments(
  segments: string[],
): Effect.Effect<
  { ciphertext: Uint8Array; iv: Uint8Array; authTag: Uint8Array },
  EncryptedCookiesError
> {
  return Effect.gen(function*() {
    const [ciphertextB64, ivB64, authTagB64] = segments

    const ciphertext = yield* Effect.try({
      try: () => base64urlDecode(ciphertextB64),
      catch: (error) => new EncryptedCookiesError({ cause: error }),
    })

    const iv = yield* Effect.try({
      try: () => base64urlDecode(ivB64),
      catch: (error) => new EncryptedCookiesError({ cause: error }),
    })

    const authTag = yield* Effect.try({
      try: () => base64urlDecode(authTagB64),
      catch: (error) => new EncryptedCookiesError({ cause: error }),
    })

    return { ciphertext, iv, authTag }
  })
}

function base64urlDecode(data: string): Uint8Array {
  // Convert base64url back to standard base64
  let base64 = data
    .replace(/-/g, "+")
    .replace(/_/g, "/")

  // Add padding if needed
  while (base64.length % 4) {
    base64 += "="
  }

  return Uint8Array.from(atob(base64), c => c.charCodeAt(0))
}

/**
 * Encrypts cookie value using the SECRET_KEY_BASE.
 */
function encryptWithDerivedKey(
  value: CookieValue,
  derivedKey: CryptoKey,
): Effect.Effect<string, EncryptedCookiesError> {
  return Effect.gen(function*() {
    if (value === null || value === undefined) {
      return yield* Effect.fail(
        new EncryptedCookiesError({
          cause: "Cannot encrypt empty value",
        }),
      )
    }

    const iv = crypto.getRandomValues(new Uint8Array(12))
    const data = new TextEncoder().encode(JSON.stringify(value))

    const encrypted = yield* Effect.tryPromise({
      try: () =>
        crypto.subtle.encrypt(
          { name: "AES-GCM", iv },
          derivedKey,
          data,
        ),
      catch: (error) => new EncryptedCookiesError({ cause: error }),
    })

    const encryptedArray = new Uint8Array(encrypted)
    const authTagLength = 16
    const ciphertext = encryptedArray.slice(0, -authTagLength)
    const authTag = encryptedArray.slice(-authTagLength)

    return encodeToBase64Segments(ciphertext, iv, authTag)
  })
}

export function encrypt(
  value: CookieValue,
  options: { key: CryptoKey } | { secret: string },
): Effect.Effect<string, EncryptedCookiesError> {
  return Effect.gen(function*() {
    if ("key" in options) {
      return yield* encryptWithDerivedKey(value, options.key)
    }

    const keyMaterial = yield* deriveKeyMaterial(options.secret)
    const derivedKey = yield* deriveKey(keyMaterial, ["encrypt"])
    return yield* encryptWithDerivedKey(value, derivedKey)
  })
}

function decryptWithDerivedKey(
  encryptedValue: string,
  derivedKey: CryptoKey,
): Effect.Effect<CookieValue, EncryptedCookiesError> {
  return Effect.gen(function*() {
    if (
      !encryptedValue || encryptedValue === null || encryptedValue === undefined
    ) {
      return yield* Effect.fail(
        new EncryptedCookiesError({
          cause: "Cannot decrypt null, undefined, or empty value",
        }),
      )
    }

    const segments = encryptedValue.split(".")
    if (segments.length !== 3) {
      return yield* Effect.fail(
        new EncryptedCookiesError({
          cause: "Invalid encrypted cookie format",
        }),
      )
    }

    const { ciphertext, iv, authTag } = yield* decodeFromBase64Segments(
      segments,
    )

    const encryptedData = new Uint8Array(ciphertext.length + authTag.length)
    encryptedData.set(ciphertext)
    encryptedData.set(authTag, ciphertext.length)

    const decrypted = yield* Effect.tryPromise({
      try: () =>
        crypto.subtle.decrypt(
          { name: "AES-GCM", iv },
          derivedKey,
          encryptedData,
        ),
      catch: (error) => new EncryptedCookiesError({ cause: error }),
    })

    const jsonString = new TextDecoder().decode(decrypted)

    return yield* Effect.try({
      try: () => JSON.parse(jsonString),
      catch: (error) => new EncryptedCookiesError({ cause: error }),
    })
  })
}

function encryptCookieWithDerivedKey(
  cookie: Cookies.Cookie,
  derivedKey: CryptoKey,
): Effect.Effect<Cookies.Cookie, EncryptedCookiesError> {
  return Effect.gen(function*() {
    const encryptedValue = yield* encryptWithDerivedKey(
      cookie.value,
      derivedKey,
    )
      .pipe(
        Effect.mapError(error =>
          new EncryptedCookiesError({
            cause: error.cause,
            cookie,
          })
        ),
      )
    return Cookies.unsafeMakeCookie(cookie.name, encryptedValue, cookie.options)
  })
}
function decryptCookieWithDerivedKey(
  cookie: Cookies.Cookie,
  derivedKey: CryptoKey,
): Effect.Effect<Cookies.Cookie, EncryptedCookiesError> {
  return Effect.gen(function*() {
    const decryptedValue = yield* decryptWithDerivedKey(
      cookie.value,
      derivedKey,
    )
      .pipe(
        Effect.mapError(error =>
          new EncryptedCookiesError({
            cause: error.cause,
            cookie,
          })
        ),
      )
    return Cookies.unsafeMakeCookie(
      cookie.name,
      JSON.stringify(decryptedValue),
      cookie.options,
    )
  })
}

export function encryptCookie(
  cookie: Cookies.Cookie,
  options: { key: CryptoKey } | { secret: string },
): Effect.Effect<Cookies.Cookie, EncryptedCookiesError> {
  return Effect.gen(function*() {
    if ("key" in options) {
      return yield* encryptCookieWithDerivedKey(cookie, options.key)
    }

    const encryptedValue = yield* encrypt(cookie.value, {
      secret: options.secret,
    })
      .pipe(
        Effect.mapError(error =>
          new EncryptedCookiesError({
            cause: error.cause,
            cookie,
          })
        ),
      )
    return Cookies.unsafeMakeCookie(cookie.name, encryptedValue, cookie.options)
  })
}

export function decryptCookie(
  cookie: Cookies.Cookie,
  options: { key: CryptoKey } | { secret: string },
): Effect.Effect<Cookies.Cookie, EncryptedCookiesError> {
  return Effect.gen(function*() {
    if ("key" in options) {
      return yield* decryptCookieWithDerivedKey(cookie, options.key)
    }

    const decryptedValue = yield* decrypt(cookie.value, {
      secret: options.secret,
    })
      .pipe(
        Effect.mapError(error =>
          new EncryptedCookiesError({
            cause: error.cause,
            cookie,
          })
        ),
      )
    return Cookies.unsafeMakeCookie(
      cookie.name,
      JSON.stringify(decryptedValue),
      cookie.options,
    )
  })
}

export function decrypt(
  encryptedValue: string,
  options: { key: CryptoKey } | { secret: string },
): Effect.Effect<CookieValue, EncryptedCookiesError> {
  return Effect.gen(function*() {
    if ("key" in options) {
      return yield* decryptWithDerivedKey(encryptedValue, options.key)
    }

    const keyMaterial = yield* deriveKeyMaterial(options.secret)
    const derivedKey = yield* deriveKey(keyMaterial, ["decrypt"])
    return yield* decryptWithDerivedKey(encryptedValue, derivedKey)
  })
}

function deriveKeyMaterial(
  secret: string,
): Effect.Effect<CryptoKey, EncryptedCookiesError> {
  return Effect.gen(function*() {
    const encoder = new TextEncoder()

    const keyMaterial = yield* Effect.tryPromise({
      try: () =>
        crypto.subtle.importKey(
          "raw",
          encoder.encode(secret),
          { name: "HKDF" },
          false,
          ["deriveKey"],
        ),
      catch: (error) => new EncryptedCookiesError({ cause: error }),
    })

    return keyMaterial
  })
}

function deriveKey(
  keyMaterial: CryptoKey,
  usage: KeyUsage[],
): Effect.Effect<CryptoKey, EncryptedCookiesError> {
  return Effect.gen(function*() {
    const encoder = new TextEncoder()

    const key = yield* Effect.tryPromise({
      try: () =>
        crypto.subtle.deriveKey(
          {
            name: "HKDF",
            salt: encoder.encode("cookie-encryption"),
            info: encoder.encode("aes-256-gcm"),
            hash: "SHA-256",
          },
          keyMaterial,
          { name: "AES-GCM", length: 256 },
          false,
          usage,
        ),
      catch: (error) => new EncryptedCookiesError({ cause: error }),
    })

    return key
  })
}

// TODO something si wrong with return type
export function handleError<E>(
  app: HttpApp.Default<E | EncryptedCookiesError>,
) {
  return Effect.gen(function*() {
    const res = yield* app.pipe(
      Effect.catchTag("EncryptedCookiesError", (error) => {
        return HttpServerResponse.empty()
      }),
    )

    return res
  })
}

function generateFriendlyKey(bits = 128) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
  const length = Math.ceil(bits / Math.log2(chars.length))
  const bytes = crypto.getRandomValues(new Uint8Array(length))

  return Array.from(bytes, b => chars[b % chars.length]).join("")
}
