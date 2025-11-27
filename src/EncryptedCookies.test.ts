import * as Cookies from "@effect/platform/Cookies"
import * as t from "bun:test"
import * as ConfigProvider from "effect/ConfigProvider"
import * as Effect from "effect/Effect"
import * as EncryptedCookies from "./EncryptedCookies.ts"

t.describe(`${EncryptedCookies.encrypt.name}`, () => {
  t.test("return encrypted string in correct format", async () => {
    const value = "hello world"

    const result = await Effect.runPromise(
      EncryptedCookies.encrypt(value, { secret: "test-secret" }),
    )

    // Check format: three base64url segments separated by .
    const segments = result.split(".")
    t.expect(segments).toHaveLength(3)

    // Each segment should be base64url (no +, /, or = characters
    // so cookie values are not escaped)
    segments.forEach((segment: string) => {
      t.expect(segment).not.toMatch(/[+/=]/)
      // Should be valid base64url that can be decoded
      const base64 = segment.replace(/-/g, "+").replace(/_/g, "/")
      const paddedBase64 = base64 + "=".repeat((4 - base64.length % 4) % 4)
      t.expect(() => atob(paddedBase64)).not.toThrow()
    })
  })

  t.test("produce different results for same input due to random IV", async () => {
    const value = "same value"

    const result1 = await Effect.runPromise(
      EncryptedCookies.encrypt(value, { secret: "test-secret" }),
    )
    const result2 = await Effect.runPromise(
      EncryptedCookies.encrypt(value, { secret: "test-secret" }),
    )

    t.expect(result1).not.toBe(result2)

    // But both should have correct format
    t.expect(result1.split(".")).toHaveLength(3)
    t.expect(result2.split(".")).toHaveLength(3)
  })

  t.test("handle empty string", async () => {
    const value = ""

    const result = await Effect.runPromise(
      EncryptedCookies.encrypt(value, { secret: "test-secret" }),
    )

    t.expect(result.split(".")).toHaveLength(3)
  })

  t.test("handle special characters", async () => {
    const value = "hello 世界! @#$%^&*()"

    const result = await Effect.runPromise(
      EncryptedCookies.encrypt(value, { secret: "test-secret" }),
    )

    t.expect(result.split(".")).toHaveLength(3)
  })

  t.test("handle object with undefined properties", async () => {
    const value = { id: "some", optional: undefined }

    const encrypted = await Effect.runPromise(
      EncryptedCookies.encrypt(value, { secret: "test-secret" }),
    )
    const decrypted = await Effect.runPromise(
      EncryptedCookies.decrypt(encrypted, { secret: "test-secret" }),
    )

    // JSON.stringify removes undefined properties
    t.expect(decrypted).toEqual({ id: "some" })
  })
})

t.describe(`${EncryptedCookies.decrypt.name}`, () => {
  t.test("decrypt encrypted string successfully", async () => {
    const originalValue = "hello world"

    const encrypted = await Effect.runPromise(
      EncryptedCookies.encrypt(originalValue, { secret: "test-secret" }),
    )
    const decrypted = await Effect.runPromise(
      EncryptedCookies.decrypt(encrypted, { secret: "test-secret" }),
    )

    t.expect(decrypted).toBe(originalValue)
  })

  t.test("handle empty string round-trip", async () => {
    const originalValue = ""

    const encrypted = await Effect.runPromise(
      EncryptedCookies.encrypt(originalValue, { secret: "test-secret" }),
    )
    const decrypted = await Effect.runPromise(
      EncryptedCookies.decrypt(encrypted, { secret: "test-secret" }),
    )

    t.expect(decrypted).toBe(originalValue)
  })

  t.test("handle special characters round-trip", async () => {
    const originalValue = "hello 世界! @#$%^&*()"

    const encrypted = await Effect.runPromise(
      EncryptedCookies.encrypt(originalValue, { secret: "test-secret" }),
    )
    const decrypted = await Effect.runPromise(
      EncryptedCookies.decrypt(encrypted, { secret: "test-secret" }),
    )

    t.expect(decrypted).toBe(originalValue)
  })

  t.test("fail with invalid format", () => {
    const invalidValue = "not-encrypted"

    t
      .expect(
        Effect.runPromise(
          EncryptedCookies.decrypt(invalidValue, { secret: "test-secret" }),
        ),
      )
      .rejects
      .toThrow()
  })

  t.test("fail with wrong number of segments", () => {
    const invalidValue = "one.two"

    t
      .expect(
        Effect.runPromise(
          EncryptedCookies.decrypt(invalidValue, { secret: "test-secret" }),
        ),
      )
      .rejects
      .toThrow()
  })

  t.test("fail with invalid base64", () => {
    const invalidValue = "invalid.base64.data"

    t
      .expect(
        Effect.runPromise(
          EncryptedCookies.decrypt(invalidValue, { secret: "test-secret" }),
        ),
      )
      .rejects
      .toThrow()
  })

  t.test("fail with null value", () => {
    t
      .expect(
        Effect.runPromise(
          EncryptedCookies.encrypt(null, { secret: "test-secret" }),
        ),
      )
      .rejects
      .toThrow()
  })

  t.test("fail with undefined value", () => {
    t
      .expect(
        Effect.runPromise(
          EncryptedCookies.encrypt(undefined, { secret: "test-secret" }),
        ),
      )
      .rejects
      .toThrow()
  })

  t.test("fail with empty encrypted value", () => {
    t
      .expect(
        Effect.runPromise(
          EncryptedCookies.decrypt("", { secret: "test-secret" }),
        ),
      )
      .rejects
      .toThrow()
  })
})

t.describe(`${EncryptedCookies.encryptCookie.name}`, () => {
  t.test("preserve cookie properties and encrypt value", async () => {
    const cookie = Cookies.unsafeMakeCookie("test", "hello world")

    const result = await Effect.runPromise(
      EncryptedCookies.encryptCookie(cookie, { secret: "test-secret" }),
    )

    // Cookie properties should be preserved
    t.expect(result.name).toBe("test")

    // Value should be encrypted (different from original)
    t.expect(result.value).not.toBe("hello world")

    // Should be in encrypted format
    t.expect(result.value.split(".")).toHaveLength(3)
  })
})

t.describe(`${EncryptedCookies.decryptCookie.name}`, () => {
  t.test("preserve cookie properties and decrypt value", async () => {
    const originalCookie = Cookies.unsafeMakeCookie("test", "hello world")

    const encrypted = await Effect.runPromise(
      EncryptedCookies.encryptCookie(originalCookie, { secret: "test-secret" }),
    )
    const decrypted = await Effect.runPromise(
      EncryptedCookies.decryptCookie(encrypted, { secret: "test-secret" }),
    )

    // Cookie properties should be preserved
    t.expect(decrypted.name).toBe("test")

    // Value should be JSON stringified (string values are now always serialized)
    t.expect(decrypted.value).toBe("\"hello world\"")
  })
})

t.describe("service", () => {
  t.test("service uses pre-calculated key material", async () => {
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

    t.expect(result.decrypted).toBe(testValue)
    t.expect(result.encrypted).not.toBe(testValue)
    t.expect(result.encrypted.split(".")).toHaveLength(3)
  })

  t.test("service cookie functions work with pre-calculated key", async () => {
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

    t.expect(result.decrypted.name).toBe("test")
    t.expect(result.decrypted.value).toBe("\"hello world\"")
    t.expect(result.encrypted.value).not.toBe("hello world")
  })

  t.test("functions work with pre-derived keys passed as options", async () => {
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

    t.expect(result.decrypted).toBe(testValue)
    t.expect(result.encrypted).not.toBe(testValue)
    t.expect(result.encrypted.split(".")).toHaveLength(3)
  })
})

t.describe("layerConfig", () => {
  t.test("succeed with valid SECRET_KEY_BASE", async () => {
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

    t.expect(result).toBe("test")
  })

  t.test("fail with short SECRET_KEY_BASE", async () => {
    const shortSecret = "short"

    const program = Effect.gen(function*() {
      const service = yield* EncryptedCookies.EncryptedCookies
      return yield* service.encrypt("test")
    })

    t
      .expect(
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

  t.test("fail with missing SECRET_KEY_BASE", async () => {
    const program = Effect.gen(function*() {
      const service = yield* EncryptedCookies.EncryptedCookies
      return yield* service.encrypt("test")
    })

    t
      .expect(
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
