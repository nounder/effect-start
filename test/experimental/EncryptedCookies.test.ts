import * as Cookies from "effect-start/Cookies"
import * as test from "bun:test"
import * as ConfigProvider from "effect/ConfigProvider"
import * as Effect from "effect/Effect"
import { EncryptedCookies } from "effect-start/experimental"

test.describe(`${EncryptedCookies.encrypt.name}`, () => {
  test.test("return encrypted string in correct format", () =>
    Effect.gen(function* () {
      const value = "hello world"

      const result = yield* EncryptedCookies.encrypt(value, { secret: "test-secret" })

      // Check format: three base64url segments separated by .
      const segments = result.split(".")

      test.expect(segments).toHaveLength(3)

      // Each segment should be base64url (no +, /, or = characters
      // so cookie values are not escaped)
      segments.forEach((segment: string) => {
        test.expect(segment).not.toMatch(/[+/=]/)
        // Should be valid base64url that can be decoded
        const base64 = segment.replace(/-/g, "+").replace(/_/g, "/")
        const paddedBase64 = base64 + "=".repeat((4 - (base64.length % 4)) % 4)

        test.expect(() => atob(paddedBase64)).not.toThrow()
      })
    }).pipe(Effect.runPromise),
  )

  test.test("produce different results for same input due to random IV", () =>
    Effect.gen(function* () {
      const value = "same value"

      const result1 = yield* EncryptedCookies.encrypt(value, { secret: "test-secret" })
      const result2 = yield* EncryptedCookies.encrypt(value, { secret: "test-secret" })

      test.expect(result1).not.toBe(result2)

      // But both should have correct format
      test.expect(result1.split(".")).toHaveLength(3)
      test.expect(result2.split(".")).toHaveLength(3)
    }).pipe(Effect.runPromise),
  )

  test.test("handle empty string", () =>
    Effect.gen(function* () {
      const value = ""

      const result = yield* EncryptedCookies.encrypt(value, { secret: "test-secret" })

      test.expect(result.split(".")).toHaveLength(3)
    }).pipe(Effect.runPromise),
  )

  test.test("handle special characters", () =>
    Effect.gen(function* () {
      const value = "hello 世界! @#$%^&*()"

      const result = yield* EncryptedCookies.encrypt(value, { secret: "test-secret" })

      test.expect(result.split(".")).toHaveLength(3)
    }).pipe(Effect.runPromise),
  )

  test.test("handle object with undefined properties", () =>
    Effect.gen(function* () {
      const value = { id: "some", optional: undefined }

      const encrypted = yield* EncryptedCookies.encrypt(value, { secret: "test-secret" })
      const decrypted = yield* EncryptedCookies.decrypt(encrypted, { secret: "test-secret" })

      // JSON.stringify removes undefined properties
      test.expect(decrypted).toEqual({ id: "some" })
    }).pipe(Effect.runPromise),
  )
})

test.describe(`${EncryptedCookies.decrypt.name}`, () => {
  test.test("decrypt encrypted string successfully", () =>
    Effect.gen(function* () {
      const originalValue = "hello world"

      const encrypted = yield* EncryptedCookies.encrypt(originalValue, { secret: "test-secret" })
      const decrypted = yield* EncryptedCookies.decrypt(encrypted, { secret: "test-secret" })

      test.expect(decrypted).toBe(originalValue)
    }).pipe(Effect.runPromise),
  )

  test.test("handle empty string round-trip", () =>
    Effect.gen(function* () {
      const originalValue = ""

      const encrypted = yield* EncryptedCookies.encrypt(originalValue, { secret: "test-secret" })
      const decrypted = yield* EncryptedCookies.decrypt(encrypted, { secret: "test-secret" })

      test.expect(decrypted).toBe(originalValue)
    }).pipe(Effect.runPromise),
  )

  test.test("handle special characters round-trip", () =>
    Effect.gen(function* () {
      const originalValue = "hello 世界! @#$%^&*()"

      const encrypted = yield* EncryptedCookies.encrypt(originalValue, { secret: "test-secret" })
      const decrypted = yield* EncryptedCookies.decrypt(encrypted, { secret: "test-secret" })

      test.expect(decrypted).toBe(originalValue)
    }).pipe(Effect.runPromise),
  )

  test.test("fail with invalid format", () => {
    const invalidValue = "not-encrypted"

    test
      .expect(Effect.runPromise(EncryptedCookies.decrypt(invalidValue, { secret: "test-secret" })))
      .rejects.toThrow()
  })

  test.test("fail with wrong number of segments", () => {
    const invalidValue = "one.two"

    test
      .expect(Effect.runPromise(EncryptedCookies.decrypt(invalidValue, { secret: "test-secret" })))
      .rejects.toThrow()
  })

  test.test("fail with invalid base64", () => {
    const invalidValue = "invalid.base64.data"

    test
      .expect(Effect.runPromise(EncryptedCookies.decrypt(invalidValue, { secret: "test-secret" })))
      .rejects.toThrow()
  })

  test.test("fail with null value", () => {
    test
      .expect(Effect.runPromise(EncryptedCookies.encrypt(null, { secret: "test-secret" })))
      .rejects.toThrow()
  })

  test.test("fail with undefined value", () => {
    test
      .expect(Effect.runPromise(EncryptedCookies.encrypt(undefined, { secret: "test-secret" })))
      .rejects.toThrow()
  })

  test.test("fail with empty encrypted value", () => {
    test
      .expect(Effect.runPromise(EncryptedCookies.decrypt("", { secret: "test-secret" })))
      .rejects.toThrow()
  })
})

test.describe(`${EncryptedCookies.encryptCookie.name}`, () => {
  test.test("preserve cookie properties and encrypt value", () =>
    Effect.gen(function* () {
      const cookie = Cookies.unsafeMakeCookie("test", "hello world")

      const result = yield* EncryptedCookies.encryptCookie(cookie, { secret: "test-secret" })

      // Cookie properties should be preserved
      test.expect(result.name).toBe("test")

      // Value should be encrypted (different from original)
      test.expect(result.value).not.toBe("hello world")

      // Should be in encrypted format
      test.expect(result.value.split(".")).toHaveLength(3)
    }).pipe(Effect.runPromise),
  )
})

test.describe(`${EncryptedCookies.decryptCookie.name}`, () => {
  test.test("preserve cookie properties and decrypt value", () =>
    Effect.gen(function* () {
      const originalCookie = Cookies.unsafeMakeCookie("test", "hello world")

      const encrypted = yield* EncryptedCookies.encryptCookie(originalCookie, {
        secret: "test-secret",
      })
      const decrypted = yield* EncryptedCookies.decryptCookie(encrypted, { secret: "test-secret" })

      // Cookie properties should be preserved
      test.expect(decrypted.name).toBe("test")

      // Value should be JSON stringified (string values are now always serialized)
      test.expect(decrypted.value).toBe('"hello world"')
    }).pipe(Effect.runPromise),
  )
})

test.describe("service", () => {
  test.test("service uses pre-calculated key material", () =>
    Effect.gen(function* () {
      const testSecret = "test-secret-key"
      const testValue = "hello world"

      const service = yield* EncryptedCookies.EncryptedCookies

      const encrypted = yield* service.encrypt(testValue)
      const decrypted = yield* service.decrypt(encrypted)

      test.expect(decrypted).toBe(testValue)
      test.expect(encrypted).not.toBe(testValue)
      test.expect(encrypted.split(".")).toHaveLength(3)
    }).pipe(
      Effect.provide(EncryptedCookies.layer({ secret: "test-secret-key" })),
      Effect.runPromise,
    ),
  )

  test.test("service cookie functions work with pre-calculated key", () =>
    Effect.gen(function* () {
      const originalCookie = Cookies.unsafeMakeCookie("test", "hello world")

      const service = yield* EncryptedCookies.EncryptedCookies

      const encrypted = yield* service.encryptCookie(originalCookie)
      const decrypted = yield* service.decryptCookie(encrypted)

      test.expect(decrypted.name).toBe("test")
      test.expect(decrypted.value).toBe('"hello world"')
      test.expect(encrypted.value).not.toBe("hello world")
    }).pipe(
      Effect.provide(EncryptedCookies.layer({ secret: "test-secret-key" })),
      Effect.runPromise,
    ),
  )

  test.test("functions work with pre-derived keys passed as options", () => {
    const testSecret = "test-secret-key"
    const testValue = "hello world"

    // Pre-derive keys manually
    const program = Effect.gen(function* () {
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

    return Effect.gen(function* () {
      const result = yield* program

      test.expect(result.decrypted).toBe(testValue)
      test.expect(result.encrypted).not.toBe(testValue)
      test.expect(result.encrypted.split(".")).toHaveLength(3)
    }).pipe(Effect.runPromise)
  })
})

test.describe("layerConfig", () => {
  test.test("succeed with valid SECRET_KEY_BASE", () => {
    const validSecret = "a".repeat(40)

    return Effect.gen(function* () {
      const service = yield* EncryptedCookies.EncryptedCookies
      const encrypted = yield* service.encrypt("test")
      const decrypted = yield* service.decrypt(encrypted)

      test.expect(decrypted).toBe("test")
    }).pipe(
      Effect.provide(EncryptedCookies.layerConfig("SECRET_KEY_BASE")),
      Effect.withConfigProvider(ConfigProvider.fromJson({ SECRET_KEY_BASE: validSecret })),
      Effect.runPromise,
    )
  })

  test.test("fail with short SECRET_KEY_BASE", () =>
    Effect.gen(function* () {
      const service = yield* EncryptedCookies.EncryptedCookies
      return yield* service.encrypt("test")
    }).pipe(
      Effect.provide(EncryptedCookies.layerConfig("SECRET_KEY_BASE")),
      Effect.withConfigProvider(ConfigProvider.fromJson({ SECRET_KEY_BASE: "short" })),
      Effect.exit,
      Effect.flatMap((exit) =>
        Effect.sync(() => {
          test.expect(exit._tag).toBe("Failure")
          test.expect(String(exit)).toContain("SECRET_KEY_BASE must be at least 40 characters")
        }),
      ),
      Effect.runPromise,
    ),
  )

  test.test("fail with missing SECRET_KEY_BASE", () =>
    Effect.gen(function* () {
      const service = yield* EncryptedCookies.EncryptedCookies
      return yield* service.encrypt("test")
    }).pipe(
      Effect.provide(EncryptedCookies.layerConfig("SECRET_KEY_BASE")),
      Effect.withConfigProvider(ConfigProvider.fromJson({})),
      Effect.exit,
      Effect.flatMap((exit) =>
        Effect.sync(() => {
          test.expect(exit._tag).toBe("Failure")
          test.expect(String(exit)).toContain("SECRET_KEY_BASE must be at least 40 characters")
        }),
      ),
      Effect.runPromise,
    ),
  )
})
