import {
  Array,
  Data,
  Effect,
  Option,
  pipe,
} from "effect"
import * as ParseResult from "effect/ParseResult"
import * as Schema from "effect/Schema"

export class CommanderError extends Data.TaggedError("CommanderError")<{
  message: string
}> {}

export type ParsedArgs = {
  readonly flags: ReadonlyArray<string>
  readonly options: ReadonlyMap<string, string>
  readonly args: ReadonlyArray<string>
}

type FlagSpec = {
  readonly type: "boolean" | "string" | "number"
  readonly long: string
  readonly short?: string
}

const parseArgvWithSpec = (
  argv: ReadonlyArray<string>,
  specs: ReadonlyArray<FlagSpec>,
): ParsedArgs => {
  const flags: Array<string> = []
  const options = new Map<string, string>()
  const args: Array<string> = []

  const isValueTakingFlag = (name: string): boolean => {
    return specs.some(
      (spec) =>
        (spec.type === "string" || spec.type === "number") &&
        (spec.long === name || spec.short === name),
    )
  }

  let i = 0
  while (i < argv.length) {
    const arg = argv[i]

    if (arg.startsWith("--")) {
      const name = arg.slice(2)

      if (isValueTakingFlag(name)) {
        const nextArg = argv[i + 1]
        if (nextArg && !nextArg.startsWith("-")) {
          options.set(name, nextArg)
          i += 2
        } else {
          i += 1
        }
      } else {
        flags.push(name)
        i += 1
      }
    } else if (arg.startsWith("-") && arg.length === 2) {
      const name = arg.slice(1)

      if (isValueTakingFlag(name)) {
        const nextArg = argv[i + 1]
        if (nextArg && !nextArg.startsWith("-")) {
          options.set(name, nextArg)
          i += 2
        } else {
          i += 1
        }
      } else {
        flags.push(name)
        i += 1
      }
    } else {
      args.push(arg)
      i += 1
    }
  }

  return {
    flags: Array.fromIterable(flags),
    options,
    args: Array.fromIterable(args),
  }
}

export const parseArgv = (argv: ReadonlyArray<string>): ParsedArgs => {
  return parseArgvWithSpec(argv, [])
}

const ParsedArgsSchema = Schema.Struct({
  flags: Schema.Array(Schema.String),
  options: Schema.Unknown,
  args: Schema.Array(Schema.String),
})

type FieldSchema<A> = Schema.Schema<A, ParsedArgs> & {
  readonly __spec: FlagSpec
}

export const boolean = <const Long extends string, const Short extends string>(
  long: Long,
  short?: Short,
): FieldSchema<boolean> => {
  const longName = long.startsWith("--") ? long.slice(2) : long
  const shortName = short?.startsWith("-") ? short.slice(1) : short

  const schema = Schema.transform(
    ParsedArgsSchema,
    Schema.Boolean,
    {
      strict: true,
      decode: (parsed) => {
        return (
          parsed.flags.includes(longName) ||
          (shortName !== undefined && parsed.flags.includes(shortName))
        )
      },
      encode: (value) => ({
        flags: value ? [longName] : [],
        options: new Map(),
        args: [],
      }),
    },
  )

  return Object.assign(schema, {
    __spec: {
      type: "boolean" as const,
      long: longName,
      short: shortName,
    },
  })
}

export const string = <const Long extends string, const Short extends string>(
  long: Long,
  short?: Short,
): FieldSchema<Option.Option<string>> => {
  const longName = long.startsWith("--") ? long.slice(2) : long
  const shortName = short?.startsWith("-") ? short.slice(1) : short

  const schema = Schema.transform(
    ParsedArgsSchema,
    Schema.OptionFromSelf(Schema.String),
    {
      strict: true,
      decode: (parsed) => {
        const opts = parsed.options as Map<string, string>
        const longValue = opts.get(longName)
        if (longValue !== undefined) {
          return Option.some(longValue)
        }

        if (shortName !== undefined) {
          const shortValue = opts.get(shortName)
          if (shortValue !== undefined) {
            return Option.some(shortValue)
          }
        }

        return Option.none()
      },
      encode: (option) => ({
        flags: [],
        options: Option.isSome(option)
          ? new Map([[longName, option.value]])
          : new Map(),
        args: [],
      }),
    },
  )

  return Object.assign(schema, {
    __spec: {
      type: "string" as const,
      long: longName,
      short: shortName,
    },
  })
}

export const number = <const Long extends string, const Short extends string>(
  long: Long,
  short?: Short,
): FieldSchema<Option.Option<number>> => {
  const longName = long.startsWith("--") ? long.slice(2) : long
  const shortName = short?.startsWith("-") ? short.slice(1) : short
  const stringSchema = string(long, short)

  const schema = pipe(
    stringSchema,
    Schema.compose(
      Schema.transform(
        Schema.OptionFromSelf(Schema.String),
        Schema.OptionFromSelf(Schema.Number),
        {
          strict: true,
          decode: (option) => {
            if (Option.isNone(option)) {
              return Option.none()
            }
            const num = Number(option.value)
            if (isNaN(num)) {
              return Option.none()
            }
            return Option.some(num)
          },
          encode: (option) => {
            if (Option.isNone(option)) {
              return Option.none()
            }
            return Option.some(String(option.value))
          },
        },
      ),
    ),
  )

  return Object.assign(schema, {
    __spec: {
      type: "number" as const,
      long: longName,
      short: shortName,
    },
  })
}

export const literal = <const Values extends ReadonlyArray<string>>(
  long: string,
  short: string | undefined,
  values: Values,
): FieldSchema<Option.Option<Values[number]>> => {
  const longName = long.startsWith("--") ? long.slice(2) : long
  const shortName = short?.startsWith("-") ? short.slice(1) : short
  const stringSchema = string(long, short)
  const literalUnion = Schema.Union(
    ...(values.map((v) => Schema.Literal(v)) as [
      Schema.Literal<[Values[number]]>,
      ...Array<Schema.Literal<[Values[number]]>>,
    ]),
  )

  const schema = pipe(
    stringSchema,
    Schema.compose(
      Schema.transform(
        Schema.OptionFromSelf(Schema.String),
        Schema.OptionFromSelf(literalUnion),
        {
          strict: true,
          decode: (option) => {
            if (Option.isNone(option)) {
              return Option.none()
            }
            if (values.includes(option.value)) {
              return Option.some(option.value as Values[number])
            }
            return Option.none()
          },
          encode: (option) => option,
        },
      ),
    ),
  )

  return Object.assign(schema, {
    __spec: {
      type: "string" as const,
      long: longName,
      short: shortName,
    },
  })
}

export const argument = (index: number): FieldSchema<Option.Option<string>> => {
  const schema = Schema.transform(
    ParsedArgsSchema,
    Schema.OptionFromSelf(Schema.String),
    {
      strict: true,
      decode: (parsed) => {
        const arg = parsed.args[index]
        if (arg !== undefined) {
          return Option.some(arg)
        }
        return Option.none()
      },
      encode: (option) => ({
        flags: [],
        options: new Map(),
        args: Option.isSome(option) ? [option.value] : [],
      }),
    },
  )

  return Object.assign(schema, {
    __spec: {
      type: "boolean" as const,
      long: `arg${index}`,
      short: undefined,
    },
  })
}

export const varargs = (): FieldSchema<ReadonlyArray<string>> => {
  const schema = Schema.transform(
    ParsedArgsSchema,
    Schema.Array(Schema.String),
    {
      strict: true,
      decode: (parsed) => parsed.args,
      encode: (args) => ({
        flags: [],
        options: new Map(),
        args,
      }),
    },
  )

  return Object.assign(schema, {
    __spec: {
      type: "boolean" as const,
      long: "varargs",
      short: undefined,
    },
  })
}

export const command = <
  OptionsSchema extends Schema.Schema.Any,
  ArgsSchema extends Schema.Schema.Any,
>(config: {
  readonly name: string
  readonly options: OptionsSchema
  readonly args?: ArgsSchema
}) => {
  return Schema.Struct({
    command: Schema.Literal(config.name),
    options: config.options,
    args: config.args ?? Schema.optionalWith(Schema.Unknown, { exact: true }),
  })
}

type StructSchema<Fields extends Record<string, Schema.Schema.Any>> = Schema.Schema<
  {
    [K in keyof Fields]: Schema.Schema.Type<Fields[K]>
  },
  ParsedArgs
> & {
  readonly __specs: ReadonlyArray<FlagSpec>
}

export const fromStruct = <Fields extends Record<string, FieldSchema<any>>>(
  fields: Fields,
): StructSchema<Fields> => {
  type Result = {
    [K in keyof Fields]: Schema.Schema.Type<Fields[K]>
  }

  const specs = Object.values(fields).map((f) => f.__spec)

  const schema = Schema.transformOrFail(
    ParsedArgsSchema,
    Schema.Unknown,
    {
      strict: true,
      decode: (parsed, _, ast) =>
        Effect.gen(function* () {
          const result: Record<string, unknown> = {}
          for (const [key, fieldSchema] of Object.entries(fields)) {
            const decoded = yield* Schema.decode(fieldSchema)(parsed)
            result[key] = decoded
          }
          return result as Result
        }),
      encode: (struct, _, ast) =>
        Effect.gen(function* () {
          const result = {
            flags: [] as string[],
            options: new Map<string, string>(),
            args: [] as string[],
          }

          for (const [key, fieldSchema] of Object.entries(fields)) {
            const value = (struct as Record<string, unknown>)[key]
            const encoded = yield* Schema.encode(fieldSchema)(value)
            result.flags.push(...encoded.flags)
            for (const [k, v] of encoded.options) {
              result.options.set(k, v)
            }
            result.args.push(...encoded.args)
          }

          return result
        }),
    },
  )

  return Object.assign(schema, {
    __specs: specs,
  }) as StructSchema<Fields>
}

export const parse = <A, I, R>(
  schema: Schema.Schema<A, I, R> | StructSchema<any>,
  argv: ReadonlyArray<string> = process.argv.slice(2),
): Effect.Effect<A, ParseResult.ParseError, R> => {
  const hasSpecs = "__specs" in schema
  const specs = hasSpecs
    ? (schema as StructSchema<any>).__specs
    : ("__spec" in schema ? [(schema as FieldSchema<any>).__spec] : [])
  const parsed = parseArgvWithSpec(argv, specs)
  return Schema.decode(schema)(parsed as I)
}

export const parseWithDefaults = <A, I, R>(
  schema: Schema.Schema<A, I, R>,
  defaults: Partial<A>,
  argv: ReadonlyArray<string> = process.argv.slice(2),
): Effect.Effect<A, ParseResult.ParseError, R> => {
  return pipe(
    parse(schema, argv),
    Effect.map((parsed) => {
      const result: Record<string, unknown> = { ...defaults }
      for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
        if (Option.isOption(value)) {
          if (Option.isSome(value)) {
            result[key] = value
          }
        } else {
          result[key] = value
        }
      }
      return result as A
    }),
  )
}
