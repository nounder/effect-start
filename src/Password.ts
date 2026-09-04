import * as Data from "effect/Data"
import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"
import * as SchemaGetter from "effect/SchemaGetter"
import * as SchemaIssue from "effect/SchemaIssue"

export class PasswordError extends Data.TaggedError("PasswordError")<{
  readonly reason: "HashFailure" | "UnsupportedAlgorithm"
  readonly algorithm?: string
  readonly cause?: unknown
}> {}

const bunAlgorithms = ["argon2d", "argon2i", "argon2id", "bcrypt"] as const
const defaultAlgorithm = "bcrypt" as const
const defaultBcryptCost = 10

type PasswordAlgorithm = (typeof bunAlgorithms)[number]

type HashOptions = {
  readonly algorithm?: PasswordAlgorithm
  readonly cost?: number
  readonly memoryCost?: number
  readonly timeCost?: number
}

export const PasswordStored = Schema.NonEmptyString.annotate({
  identifier: "PasswordStored",
  description: "A stored password hash string.",
})

export type PasswordStored = typeof PasswordStored.Type

const PlainTextPassword = Schema.NonEmptyString.annotate({
  identifier: "PasswordPlainText",
  description: "A plain-text password that will be hashed when decoded.",
})

function makePasswordSchema(options?: HashOptions) {
  return PlainTextPassword.pipe(
    Schema.decodeTo(PasswordStored, {
      decode: SchemaGetter.transformOrFail((input) =>
        hash(input, options).pipe(
          Effect.mapError((error) => new SchemaIssue.InvalidValue({ message: formatError(error) })),
        )
      ),
      encode: SchemaGetter.forbidden(
        () => "Password hashes are write-only and cannot be encoded back to plain text.",
      ),
    }),
    Schema.annotate({
      identifier: "Password",
      description: "A write-only password schema that decodes plain text into a password hash.",
    }),
  )
}

export function schemaPassword(options?: HashOptions) {
  return makePasswordSchema(options)
}

export function hash(
  password: string,
  options?: HashOptions,
): Effect.Effect<PasswordStored, PasswordError> {
  return Effect.gen(function*() {
    const algorithm = options?.algorithm ?? defaultAlgorithm

    const digest = yield* Effect.tryPromise({
      try: () => Bun.password.hash(password, toBunAlgorithm(options)),
      catch: (cause) =>
        new PasswordError({
          reason: isSupportedAlgorithm(algorithm)
            ? "HashFailure"
            : "UnsupportedAlgorithm",
          algorithm,
          cause,
        }),
    })

    return digest
  })
}

export function verify(
  password: string,
  stored: PasswordStored,
): Effect.Effect<boolean, PasswordError> {
  return Effect.tryPromise({
    try: () => Bun.password.verify(password, stored),
    catch: (cause) =>
      new PasswordError({
        reason: "HashFailure",
        cause,
      }),
  })
}

function toBunAlgorithm(
  options?: HashOptions,
):
  | Bun.Password.AlgorithmLabel
  | Bun.Password.Argon2Algorithm
  | Bun.Password.BCryptAlgorithm
{
  const algorithm = options?.algorithm ?? defaultAlgorithm

  switch (algorithm) {
    case "bcrypt":
      return {
        algorithm,
        cost: options?.cost ?? defaultBcryptCost,
      }
    case "argon2d":
    case "argon2i":
    case "argon2id":
      return {
        algorithm,
        memoryCost: options?.memoryCost,
        timeCost: options?.timeCost,
      }
  }
}

function isSupportedAlgorithm(
  algorithm: string,
): algorithm is PasswordAlgorithm {
  return bunAlgorithms.includes(algorithm as PasswordAlgorithm)
}

function formatError(error: PasswordError): string {
  switch (error.reason) {
    case "UnsupportedAlgorithm":
      return `Unsupported password hash algorithm: ${error.algorithm ?? "unknown"}`
    case "HashFailure":
      return `Failed to hash password with ${error.algorithm ?? "unknown"}`
  }
}
