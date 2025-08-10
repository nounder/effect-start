import { Cookies } from "@effect/platform"
import {
  describe,
  expect,
  test,
} from "bun:test"
import { Effect } from "effect"
import * as ConfigProvider from "effect/ConfigProvider"
import * as EncryptedCookies from "./EncryptedCookies.ts"

describe("encrypt", () => {
  test("return encrypted string in correct format", async () => {
    const value = "hello world"

    const result = await Effect.runPromise(
      EncryptedCookies.encrypt(value, { secret: "test-secret" }),
    )

    // Check format: three base64url segments separated by .
    const segments = result.split(".")
    expect(segments).toHaveLength(3)

    // Each segment should be base64url (no +, /, or = characters
    // so cookie values are not escaped)
    segments.forEach((segment: string) => {
      expect(segment).not.toMatch(/[+/=]/)
      // Should be valid base64url that can be decoded
      const base64 = segment.replace(/-/g, "+").replace(/_/g, "/")
      const paddedBase64 = base64 + "=".repeat((4 - base64.length % 4) % 4)
      expect(() => atob(paddedBase64)).not.toThrow()
    })
  })

  test("produce different results for same input due to random IV", async () => {
    const value = "same value"

    const result1 = await Effect.runPromise(
      EncryptedCookies.encrypt(value, { secret: "test-secret" }),
    )
    const result2 = await Effect.runPromise(
      EncryptedCookies.encrypt(value, { secret: "test-secret" }),
    )

    expect(result1).not.toBe(result2)

    // But both should have correct format
    expect(result1.split(".")).toHaveLength(3)
    expect(result2.split(".")).toHaveLength(3)
  })

  test("handle empty string", async () => {
    const value = ""

    const result = await Effect.runPromise(
      EncryptedCookies.encrypt(value, { secret: "test-secret" }),
    )

    expect(result.split(".")).toHaveLength(3)
  })

  test("handle special characters", async () => {
    const value = "hello 世界! @#$%^&*()"

    const result = await Effect.runPromise(
      EncryptedCookies.encrypt(value, { secret: "test-secret" }),
    )

    expect(result.split(".")).toHaveLength(3)
  })

  test("handle object with undefined properties", async () => {
    const value = { id: "some", optional: undefined }

    const encrypted = await Effect.runPromise(
      EncryptedCookies.encrypt(value, { secret: "test-secret" }),
    )
    const decrypted = await Effect.runPromise(
      EncryptedCookies.decrypt(encrypted, { secret: "test-secret" }),
    )

    // JSON.stringify removes undefined properties
    expect(decrypted).toEqual({ id: "some" })
  })
})

describe("decrypt", () => {
  test("decrypt encrypted string successfully", async () => {
    const originalValue = "hello world"

    const encrypted = await Effect.runPromise(
      EncryptedCookies.encrypt(originalValue, { secret: "test-secret" }),
    )
    const decrypted = await Effect.runPromise(
      EncryptedCookies.decrypt(encrypted, { secret: "test-secret" }),
    )

    expect(decrypted).toBe(originalValue)
  })

  test("handle empty string round-trip", async () => {
    const originalValue = ""

    const encrypted = await Effect.runPromise(
      EncryptedCookies.encrypt(originalValue, { secret: "test-secret" }),
    )
    const decrypted = await Effect.runPromise(
      EncryptedCookies.decrypt(encrypted, { secret: "test-secret" }),
    )

    expect(decrypted).toBe(originalValue)
  })

  test("handle special characters round-trip", async () => {
    const originalValue = "hello 世界! @#$%^&*()"

    const encrypted = await Effect.runPromise(
      EncryptedCookies.encrypt(originalValue, { secret: "test-secret" }),
    )
    const decrypted = await Effect.runPromise(
      EncryptedCookies.decrypt(encrypted, { secret: "test-secret" }),
    )

    expect(decrypted).toBe(originalValue)
  })

  test("fail with invalid format", () => {
    const invalidValue = "not-encrypted"

    expect(
      Effect.runPromise(
        EncryptedCookies.decrypt(invalidValue, { secret: "test-secret" }),
      ),
    )
      .rejects
      .toThrow()
  })

  test("fail with wrong number of segments", () => {
    const invalidValue = "one.two"

    expect(
      Effect.runPromise(
        EncryptedCookies.decrypt(invalidValue, { secret: "test-secret" }),
      ),
    )
      .rejects
      .toThrow()
  })

  test("fail with invalid base64", () => {
    const invalidValue = "invalid.base64.data"

    expect(
      Effect.runPromise(
        EncryptedCookies.decrypt(invalidValue, { secret: "test-secret" }),
      ),
    )
      .rejects
      .toThrow()
  })

  test("fail with null value", () => {
    expect(
      Effect.runPromise(
        EncryptedCookies.encrypt(null, { secret: "test-secret" }),
      ),
    )
      .rejects
      .toThrow()
  })

  test("fail with undefined value", () => {
    expect(
      Effect.runPromise(
        EncryptedCookies.encrypt(undefined, { secret: "test-secret" }),
      ),
    )
      .rejects
      .toThrow()
  })

  test("fail with empty encrypted value", () => {
    expect(
      Effect.runPromise(
        EncryptedCookies.decrypt("", { secret: "test-secret" }),
      ),
    )
      .rejects
      .toThrow()
  })
})

describe("encryptCookie", () => {
  test("preserve cookie properties and encrypt value", async () => {
    const cookie = Cookies.unsafeMakeCookie("test", "hello world")

    const result = await Effect.runPromise(
      EncryptedCookies.encryptCookie(cookie, { secret: "test-secret" }),
    )

    // Cookie properties should be preserved
    expect(result.name).toBe("test")

    // Value should be encrypted (different from original)
    expect(result.value).not.toBe("hello world")

    // Should be in encrypted format
    expect(result.value.split(".")).toHaveLength(3)
  })
})

describe("decryptCookie", () => {
  test("preserve cookie properties and decrypt value", async () => {
    const originalCookie = Cookies.unsafeMakeCookie("test", "hello world")

    const encrypted = await Effect.runPromise(
      EncryptedCookies.encryptCookie(originalCookie, { secret: "test-secret" }),
    )
    const decrypted = await Effect.runPromise(
      EncryptedCookies.decryptCookie(encrypted, { secret: "test-secret" }),
    )

    // Cookie properties should be preserved
    expect(decrypted.name).toBe("test")

    // Value should be JSON stringified (string values are now always serialized)
    expect(decrypted.value).toBe("\"hello world\"")
  })
})

describe("service", () => {
  test("service uses pre-calculated key material", async () => {
    const testSecret = "test-secret-key"
    const testValue = "hello world"

    const program = Effect.gen(function*() {
      const service = yield* EncryptedCookies.EncryptedCookies

      const encrypted = yield* service.encrypt(testValue)
      const decrypted = yield* service.decrypt(encrypted)

      return { encrypted, decrypted }
    })

    const result = await Effect.runPromise(
      program.pipe(
        Effect.provide(EncryptedCookies.layer({ secret: testSecret })),
      ),
    )

    expect(result.decrypted).toBe(testValue)
    expect(result.encrypted).not.toBe(testValue)
    expect(result.encrypted.split(".")).toHaveLength(3)
  })

  test("service cookie functions work with pre-calculated key", async () => {
    const testSecret = "test-secret-key"
    const originalCookie = Cookies.unsafeMakeCookie("test", "hello world")

    const program = Effect.gen(function*() {
      const service = yield* EncryptedCookies.EncryptedCookies

      const encrypted = yield* service.encryptCookie(originalCookie)
      const decrypted = yield* service.decryptCookie(encrypted)

      return { encrypted, decrypted }
    })

    const result = await Effect.runPromise(
      program.pipe(
        Effect.provide(EncryptedCookies.layer({ secret: testSecret })),
      ),
    )

    expect(result.decrypted.name).toBe("test")
    expect(result.decrypted.value).toBe("\"hello world\"")
    expect(result.encrypted.value).not.toBe("hello world")
  })

  test("functions work with pre-derived keys passed as options", async () => {
    const testSecret = "test-secret-key"
    const testValue = "hello world"

    // Pre-derive keys manually
    const program = Effect.gen(function*() {
      const keyMaterial = yield* Effect.tryPromise({
        try: () =>
          crypto.subtle.importKey(
            "raw",
            new TextEncoder().encode(testSecret),
            { name: "HKDF" },
            false,
            ["deriveKey"],
          ),
        catch: (error) => error,
      })

      const encryptKey = yield* Effect.tryPromise({
        try: () =>
          crypto.subtle.deriveKey(
            {
              name: "HKDF",
              salt: new TextEncoder().encode("cookie-encryption"),
              info: new TextEncoder().encode("aes-256-gcm"),
              hash: "SHA-256",
            },
            keyMaterial,
            { name: "AES-GCM", length: 256 },
            false,
            ["encrypt"],
          ),
        catch: (error) => error,
      })

      const decryptKey = yield* Effect.tryPromise({
        try: () =>
          crypto.subtle.deriveKey(
            {
              name: "HKDF",
              salt: new TextEncoder().encode("cookie-encryption"),
              info: new TextEncoder().encode("aes-256-gcm"),
              hash: "SHA-256",
            },
            keyMaterial,
            { name: "AES-GCM", length: 256 },
            false,
            ["decrypt"],
          ),
        catch: (error) => error,
      })

      // Use functions with pre-derived keys
      const encrypted = yield* EncryptedCookies.encrypt(testValue, {
        key: encryptKey,
      })
      const decrypted = yield* EncryptedCookies.decrypt(encrypted, {
        key: decryptKey,
      })

      return { encrypted, decrypted }
    })

    const result = await Effect.runPromise(program)

    expect(result.decrypted).toBe(testValue)
    expect(result.encrypted).not.toBe(testValue)
    expect(result.encrypted.split(".")).toHaveLength(3)
  })
})

describe("layerConfig", () => {
  test("succeed with valid SECRET_KEY_BASE", async () => {
    const validSecret = "a".repeat(40)

    const program = Effect.gen(function*() {
      const service = yield* EncryptedCookies.EncryptedCookies
      const encrypted = yield* service.encrypt("test")
      const decrypted = yield* service.decrypt(encrypted)
      return decrypted
    })

    const result = await Effect.runPromise(
      program.pipe(
        Effect.provide(
          EncryptedCookies.layerConfig("SECRET_KEY_BASE"),
        ),
        Effect.withConfigProvider(
          ConfigProvider.fromMap(
            new Map([["SECRET_KEY_BASE", validSecret]]),
          ),
        ),
      ),
    )

    expect(result).toBe("test")
  })

  test("fail with short SECRET_KEY_BASE", async () => {
    const shortSecret = "short"

    const program = Effect.gen(function*() {
      const service = yield* EncryptedCookies.EncryptedCookies
      return yield* service.encrypt("test")
    })

    expect(
      Effect.runPromise(
        program.pipe(
          Effect.provide(
            EncryptedCookies.layerConfig("SECRET_KEY_BASE"),
          ),
          Effect.withConfigProvider(
            ConfigProvider.fromMap(
              new Map([["SECRET_KEY_BASE", shortSecret]]),
            ),
          ),
        ),
      ),
    )
      .rejects
      .toThrow("SECRET_KEY_BASE must be at least 40 characters")
  })

  test("fail with missing SECRET_KEY_BASE", async () => {
    const program = Effect.gen(function*() {
      const service = yield* EncryptedCookies.EncryptedCookies
      return yield* service.encrypt("test")
    })

    expect(
      Effect.runPromise(
        program.pipe(
          Effect.provide(
            EncryptedCookies.layerConfig("SECRET_KEY_BASE"),
          ),
          Effect.withConfigProvider(ConfigProvider.fromMap(new Map())),
        ),
      ),
    )
      .rejects
      .toThrow("SECRET_KEY_BASE must be at least 40 characters")
  })
})
