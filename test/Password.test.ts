import * as test from "bun:test"
import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"
import * as Password from "effect-start/Password"

test.describe("Password.schemaPassword", () => {
  test.it("decodes password into a password hash on the same field", () =>
    Effect.gen(function* () {
      const UserCreate = Schema.Struct({
        email: Schema.String,
        password: Password.schemaPassword(),
      })

      test.expectTypeOf<Schema.Schema.Type<typeof UserCreate>>().toMatchTypeOf<{
        email: string
        password: Password.PasswordStored
      }>()
      test.expectTypeOf<Schema.Schema.Encoded<typeof UserCreate>>().toMatchTypeOf<{
        email: string
        password: string
      }>()

      const user = yield* Schema.decodeUnknown(UserCreate)({
        email: "alice@example.com",
        password: "correct horse battery staple",
      })

      test.expect(user.email).toBe("alice@example.com")
      test.expect(user.password).toMatch(/^\$2[aby]\$/)
      test.expect(yield* Password.verify("correct horse battery staple", user.password)).toBe(true)
      test.expect(yield* Password.verify("wrong password", user.password)).toBe(false)
    }).pipe(Effect.runPromise),
  )

  test.it("treats password hashes as write-only", () =>
    Effect.gen(function* () {
      const UserCreate = Schema.Struct({
        password: Password.schemaPassword(),
      })
      const stored = yield* Password.hash("secret")

      const exit = yield* Effect.exit(
        Schema.encodeUnknown(UserCreate)({
          password: stored,
        }),
      )

      test.expect(exit._tag).toBe("Failure")
    }).pipe(Effect.runPromise),
  )
})
