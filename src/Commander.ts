import * as Array from "effect/Array"
import * as Data from "effect/Data"
import * as Effect from "effect/Effect"
import * as Option from "effect/Option"
import * as ParseResult from "effect/ParseResult"
import * as Record from "effect/Record"
import * as Schema from "effect/Schema"
import * as String from "effect/String"

export class ParseError extends Data.TaggedError("ParseError")<{
  message: string
  args?: ReadonlyArray<string>
}> {}

export class ValidationError extends Data.TaggedError("ValidationError")<{
  field: string
  message: string
  cause?: unknown
}> {}

export interface OptionSpec<A> {
  readonly _tag: "OptionSpec"
  readonly schema: Schema.Schema<A, string>
  readonly short?: string
  readonly long?: string
  readonly description?: string
  readonly defaultValue?: A
  readonly required?: boolean
}

export interface ArgumentSpec<A> {
  readonly _tag: "ArgumentSpec"
  readonly schema: Schema.Schema<A, string>
  readonly name: string
  readonly description?: string
  readonly required?: boolean
  readonly defaultValue?: A
}

export interface CommandSpec<
  Opts extends Record<string, OptionSpec<any>>,
  Args extends ReadonlyArray<ArgumentSpec<any>>,
> {
  readonly name: string
  readonly description?: string
  readonly options: Opts
  readonly args: Args
}

export type InferOptions<Opts extends Record<string, OptionSpec<any>>> = {
  [K in keyof Opts]: Opts[K] extends OptionSpec<infer A> ? A : never
}

export type InferArgs<Args extends ReadonlyArray<ArgumentSpec<any>>> = {
  [K in keyof Args]: Args[K] extends ArgumentSpec<infer A> ? A : never
}

export interface ParsedCommand<
  Opts extends Record<string, OptionSpec<any>>,
  Args extends ReadonlyArray<ArgumentSpec<any>>,
> {
  readonly options: InferOptions<Opts>
  readonly args: InferArgs<Args>
}

export const boolean = (config?: {
  short?: string
  long?: string
  description?: string
  defaultValue?: boolean
}): OptionSpec<boolean> => ({
  _tag: "OptionSpec",
  schema: Schema.transform(
    Schema.String,
    Schema.Boolean,
    {
      strict: false,
      decode: (s) => {
        if (s === "true" || s === "1" || s === "") return true
        if (s === "false" || s === "0") return false
        return true
      },
      encode: (b) => (b ? "true" : "false"),
    },
  ),
  short: config?.short,
  long: config?.long,
  description: config?.description,
  defaultValue: config?.defaultValue,
  required: false,
})

export const string = (config?: {
  short?: string
  long?: string
  description?: string
  defaultValue?: string
  required?: boolean
}): OptionSpec<string> => ({
  _tag: "OptionSpec",
  schema: Schema.String,
  short: config?.short,
  long: config?.long,
  description: config?.description,
  defaultValue: config?.defaultValue,
  required: config?.required ?? false,
})

export const number = (config?: {
  short?: string
  long?: string
  description?: string
  defaultValue?: number
  required?: boolean
}): OptionSpec<number> => ({
  _tag: "OptionSpec",
  schema: Schema.NumberFromString,
  short: config?.short,
  long: config?.long,
  description: config?.description,
  defaultValue: config?.defaultValue,
  required: config?.required ?? false,
})

export const option = <A>(
  schema: Schema.Schema<A, string>,
  config?: {
    short?: string
    long?: string
    description?: string
    defaultValue?: A
    required?: boolean
  },
): OptionSpec<A> => ({
  _tag: "OptionSpec",
  schema,
  short: config?.short,
  long: config?.long,
  description: config?.description,
  defaultValue: config?.defaultValue,
  required: config?.required ?? false,
})

export const argument = <A>(
  schema: Schema.Schema<A, string>,
  config?: {
    name?: string
    description?: string
    defaultValue?: A
    required?: boolean
  },
): ArgumentSpec<A> => ({
  _tag: "ArgumentSpec",
  schema,
  name: config?.name ?? "arg",
  description: config?.description,
  defaultValue: config?.defaultValue,
  required: config?.required ?? true,
})

export const command = <
  Opts extends Record<string, OptionSpec<any>>,
  Args extends ReadonlyArray<ArgumentSpec<any>>,
>(
  spec: CommandSpec<Opts, Args>,
): CommandSpec<Opts, Args> => spec

interface ParseState {
  readonly options: Map<string, string>
  readonly positional: ReadonlyArray<string>
}

const parseArgv = (argv: ReadonlyArray<string>): ParseState => {
  const options = new Map<string, string>()
  const positional: string[] = []
  let i = 0

  while (i < argv.length) {
    const arg = argv[i]!

    if (arg === "--") {
      positional.push(...argv.slice(i + 1))
      break
    }

    if (arg.startsWith("--")) {
      const eqIndex = arg.indexOf("=")
      if (eqIndex !== -1) {
        const key = arg.slice(2, eqIndex)
        const value = arg.slice(eqIndex + 1)
        options.set(key, value)
      } else {
        const key = arg.slice(2)
        const next = argv[i + 1]
        if (next && !next.startsWith("-")) {
          options.set(key, next)
          i++
        } else {
          options.set(key, "")
        }
      }
    } else if (arg.startsWith("-") && arg.length > 1) {
      const flags = arg.slice(1)
      for (let j = 0; j < flags.length; j++) {
        const flag = flags[j]!
        if (j === flags.length - 1) {
          const next = argv[i + 1]
          if (next && !next.startsWith("-")) {
            options.set(flag, next)
            i++
          } else {
            options.set(flag, "")
          }
        } else {
          options.set(flag, "")
        }
      }
    } else {
      positional.push(arg)
    }

    i++
  }

  return { options, positional }
}

const resolveOptionValue = <A>(
  spec: OptionSpec<A>,
  key: string,
  state: ParseState,
): Option.Option<string> => {
  if (spec.long && state.options.has(spec.long)) {
    return Option.some(state.options.get(spec.long)!)
  }

  if (spec.short && state.options.has(spec.short)) {
    return Option.some(state.options.get(spec.short)!)
  }

  return Option.none()
}

const decodeOption = <A>(
  schema: Schema.Schema<A, string>,
  value: string,
  field: string,
): Effect.Effect<A, ValidationError, never> =>
  Schema.decodeUnknown(schema)(value).pipe(
    Effect.mapError((error) =>
      new ValidationError({
        field,
        message: `Invalid value for option '${field}'`,
        cause: error,
      }),
    ),
  )

const decodeArgument = <A>(
  schema: Schema.Schema<A, string>,
  value: string,
  name: string,
): Effect.Effect<A, ValidationError, never> =>
  Schema.decodeUnknown(schema)(value).pipe(
    Effect.mapError((error) =>
      new ValidationError({
        field: name,
        message: `Invalid value for argument '${name}'`,
        cause: error,
      }),
    ),
  )

const parseOptions = <Opts extends Record<string, OptionSpec<any>>>(
  spec: Opts,
  state: ParseState,
) =>
  Effect.sync(() => {
    const options: Record<string, any> = {}
    const effects: Array<Effect.Effect<void, ValidationError, never>> = []

    for (const [key, optSpec] of Object.entries(spec)) {
      const valueOpt = resolveOptionValue(optSpec, key, state)

      if (Option.isNone(valueOpt)) {
        if (optSpec.required) {
          effects.push(
            Effect.fail(
              new ValidationError({
                field: key,
                message: `Required option '${optSpec.long ?? optSpec.short ?? key}' not provided`,
              }),
            ),
          )
        } else if (optSpec.defaultValue !== undefined) {
          options[key] = optSpec.defaultValue
        } else {
          options[key] = undefined
        }
      } else {
        const value = valueOpt.value
        const fieldName = optSpec.long ?? optSpec.short ?? key

        effects.push(
          decodeOption(optSpec.schema, value, fieldName).pipe(
            Effect.map((decoded) => {
              options[key] = decoded
            }),
          ),
        )
      }
    }

    return { options, effects }
  }).pipe(
    Effect.flatMap(({ options, effects }) =>
      Effect.all(effects, { concurrency: "unbounded" }).pipe(
        Effect.map(() => options as InferOptions<Opts>),
      ),
    ),
  )

const parseArguments = <Args extends ReadonlyArray<ArgumentSpec<any>>>(
  spec: Args,
  state: ParseState,
) =>
  Effect.sync(() => {
    const args: any[] = []
    const effects: Array<Effect.Effect<void, ValidationError, never>> = []

    for (let i = 0; i < spec.length; i++) {
      const argSpec = spec[i]!
      const value = state.positional[i]

      if (value === undefined) {
        if (argSpec.required) {
          effects.push(
            Effect.fail(
              new ValidationError({
                field: argSpec.name,
                message: `Required argument '${argSpec.name}' not provided`,
              }),
            ),
          )
        } else if (argSpec.defaultValue !== undefined) {
          args.push(argSpec.defaultValue)
        } else {
          args.push(undefined)
        }
      } else {
        effects.push(
          decodeArgument(argSpec.schema, value, argSpec.name).pipe(
            Effect.map((decoded) => {
              args.push(decoded)
            }),
          ),
        )
      }
    }

    return { args, effects }
  }).pipe(
    Effect.flatMap(({ args, effects }) =>
      Effect.all(effects, { concurrency: "unbounded" }).pipe(
        Effect.map(() => args as InferArgs<Args>),
      ),
    ),
  )

export const parse = <
  Opts extends Record<string, OptionSpec<any>>,
  Args extends ReadonlyArray<ArgumentSpec<any>>,
>(
  spec: CommandSpec<Opts, Args>,
  argv: ReadonlyArray<string>,
): Effect.Effect<
  ParsedCommand<Opts, Args>,
  ParseError | ValidationError,
  never
> => {
  const state = parseArgv(argv)

  return parseOptions(spec.options, state).pipe(
    Effect.flatMap((options) =>
      parseArguments(spec.args, state).pipe(
        Effect.map((args) => ({ options, args })),
      ),
    ),
  )
}

export const help = <
  Opts extends Record<string, OptionSpec<any>>,
  Args extends ReadonlyArray<ArgumentSpec<any>>,
>(
  spec: CommandSpec<Opts, Args>,
): string => {
  const lines: string[] = []

  if (spec.description) {
    lines.push(spec.description)
    lines.push("")
  }

  lines.push("Usage:")
  const optionsStr = Object.keys(spec.options).length > 0 ? "[OPTIONS]" : ""
  const argsStr = spec.args
    .map((arg) => (arg.required ? `<${arg.name}>` : `[${arg.name}]`))
    .join(" ")
  lines.push(`  ${spec.name} ${optionsStr} ${argsStr}`.trim())
  lines.push("")

  if (spec.args.length > 0) {
    lines.push("Arguments:")
    for (const arg of spec.args) {
      const requiredStr = arg.required ? "required" : "optional"
      const desc = arg.description ? ` - ${arg.description}` : ""
      const defaultStr = arg.defaultValue !== undefined
        ? ` (default: ${arg.defaultValue})`
        : ""
      lines.push(`  ${arg.name}  [${requiredStr}]${desc}${defaultStr}`)
    }
    lines.push("")
  }

  if (Object.keys(spec.options).length > 0) {
    lines.push("Options:")
    for (const [key, opt] of Object.entries(spec.options)) {
      const shortFlag = opt.short ? `-${opt.short}, ` : "    "
      const longFlag = opt.long ? `--${opt.long}` : `--${key}`
      const requiredStr = opt.required ? " [required]" : ""
      const desc = opt.description ? ` - ${opt.description}` : ""
      const defaultStr = opt.defaultValue !== undefined
        ? ` (default: ${opt.defaultValue})`
        : ""
      lines.push(`  ${shortFlag}${longFlag}${requiredStr}${desc}${defaultStr}`)
    }
  }

  return lines.join("\n")
}
