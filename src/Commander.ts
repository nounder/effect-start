import * as Data from "effect/Data"
import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"

export class ParseError extends Data.TaggedError("ParseError")<{
  readonly message: string
  readonly cause?: unknown
}> {}

export type ParseConfig = {
  readonly aliases?: Record<string, string>
  readonly positional?: readonly string[]
}

type ParsedArgs = {
  readonly options: Record<string, string | boolean>
  readonly positional: readonly string[]
}

const extractBooleanFields = (schema: Schema.Schema.Any): Set<string> => {
  const booleanFields = new Set<string>()

  if (Schema.isSchema(schema) && "fields" in schema) {
    const fields = (schema as any).fields
    for (const [key, fieldSchema] of Object.entries(fields)) {
      const ast = (fieldSchema as any).ast ?? (fieldSchema as any)
      if (ast && typeof ast === "object") {
        const typeName = ast._tag || ast.type?._tag || ""
        if (
          typeName === "BooleanKeyword" ||
          (ast.to && ast.to._tag === "BooleanKeyword")
        ) {
          booleanFields.add(key)
        }
      }
    }
  }

  return booleanFields
}

const parseArgs = (
  args: readonly string[],
  aliases: Record<string, string> = {},
  booleanFields: Set<string> = new Set(),
): ParsedArgs => {
  const options: Record<string, string | boolean> = {}
  const positional: string[] = []
  let i = 0

  while (i < args.length) {
    const arg = args[i]

    if (arg.startsWith("--")) {
      const equalsIndex = arg.indexOf("=")
      if (equalsIndex !== -1) {
        const key = arg.slice(2, equalsIndex)
        const value = arg.slice(equalsIndex + 1)
        options[key] = value
        i++
      } else {
        const key = arg.slice(2)
        const isBoolean = booleanFields.has(key)

        if (isBoolean) {
          options[key] = true
          i++
        } else {
          const nextArg = args[i + 1]
          if (nextArg && !nextArg.startsWith("-")) {
            options[key] = nextArg
            i += 2
          } else {
            options[key] = true
            i++
          }
        }
      }
    } else if (arg.startsWith("-") && arg.length > 1 && arg !== "-") {
      const flags = arg.slice(1)
      let consumed = false

      for (let j = 0; j < flags.length; j++) {
        const flag = flags[j]
        const aliasKey = aliases[flag]
        const key = aliasKey ?? flag
        const isBoolean = booleanFields.has(key)

        if (j === flags.length - 1 && !isBoolean) {
          const nextArg = args[i + 1]
          if (nextArg && !nextArg.startsWith("-")) {
            options[key] = nextArg
            i += 2
            consumed = true
            break
          }
        }

        options[key] = true
      }

      if (!consumed) {
        i++
      }
    } else {
      positional.push(arg)
      i++
    }
  }

  return { options, positional }
}

const buildInput = (
  parsed: ParsedArgs,
  positionalKeys: readonly string[] = [],
): Record<string, any> => {
  const result: Record<string, any> = { ...parsed.options }

  for (let i = 0; i < positionalKeys.length; i++) {
    const key = positionalKeys[i]
    if (i < parsed.positional.length) {
      result[key] = parsed.positional[i]
    }
  }

  return result
}

export const parse = <A, I, R>(
  schema: Schema.Schema<A, I, R>,
  args: readonly string[],
  config?: ParseConfig,
): Effect.Effect<A, ParseError, R> =>
  Effect.gen(function*() {
    const booleanFields = extractBooleanFields(schema)
    const parsed = parseArgs(args, config?.aliases, booleanFields)
    const input = buildInput(parsed, config?.positional)

    const decoded = yield* Schema.decodeUnknown(schema)(input).pipe(
      Effect.mapError((error) =>
        new ParseError({
          message: `Failed to parse arguments`,
          cause: error,
        })
      ),
    )

    return decoded
  })

export const NumberFromString = Schema.NumberFromString

export const optional = Schema.optional

export const BooleanFromString = Schema.Union(
  Schema.Boolean,
  Schema.BooleanFromString,
)
