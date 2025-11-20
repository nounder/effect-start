import * as Array from "effect/Array"
import * as Data from "effect/Data"
import * as Effect from "effect/Effect"
import * as Option from "effect/Option"
import * as Schema from "effect/Schema"
import * as String from "effect/String"

export class CommanderError extends Data.TaggedError("CommanderError")<{
  message: string
  cause?: unknown
}> {}

export interface Flag {
  readonly _tag: "Flag"
  readonly short?: string
  readonly long: string
  readonly description: string
}

export interface OptionDef<A> {
  readonly _tag: "OptionDef"
  readonly short?: string
  readonly long: string
  readonly description: string
  readonly schema: Schema.Schema<A, string>
  readonly defaultValue?: A
}

export interface Argument<A> {
  readonly _tag: "Argument"
  readonly name: string
  readonly description: string
  readonly schema: Schema.Schema<A, string>
  readonly optional: boolean
}

export const flag = (
  long: string,
  options?: {
    readonly short?: string
    readonly description?: string
  }
): Flag => ({
  _tag: "Flag",
  long,
  short: options?.short,
  description: options?.description ?? ""
})

export const option = <A>(
  long: string,
  schema: Schema.Schema<A, string>,
  options?: {
    readonly short?: string
    readonly description?: string
    readonly defaultValue?: A
  }
): OptionDef<A> => ({
  _tag: "OptionDef",
  long,
  schema,
  short: options?.short,
  description: options?.description ?? "",
  defaultValue: options?.defaultValue
})

export const argument = <A>(
  name: string,
  schema: Schema.Schema<A, string>,
  options?: {
    readonly description?: string
    readonly optional?: boolean
  }
): Argument<A> => ({
  _tag: "Argument",
  name,
  schema,
  description: options?.description ?? "",
  optional: options?.optional ?? false
})

export interface Command<Opts, Args> {
  readonly name: string
  readonly description?: string
  readonly version?: string
  readonly flagsMap: ReadonlyMap<string, string>
  readonly optionsMap: ReadonlyMap<string, { def: OptionDef<any>; key: string }>
  readonly arguments: ReadonlyArray<Argument<any>>
  readonly optionsSchema: Schema.Schema<Opts>
  readonly argumentsSchema: Schema.Schema<Args>
}

export const command = <
  const Opts extends Record<string, any>,
  const Args
>(config: {
  readonly name: string
  readonly description?: string
  readonly version?: string
  readonly options?: {
    readonly [K in keyof Opts]: Flag | OptionDef<Opts[K]>
  }
  readonly arguments?: ReadonlyArray<Argument<any>>
}): Command<Opts, Args> => {
  const flagsMap = new Map<string, string>()
  const optionsMap = new Map<string, { def: OptionDef<any>; key: string }>()
  const optionsFields: Record<string, Schema.Schema<any>> = {}

  if (config.options) {
    for (const [key, def] of Object.entries(config.options)) {
      if (def._tag === "Flag") {
        flagsMap.set(def.long, key)
        if (def.short) {
          flagsMap.set(def.short, key)
        }
        optionsFields[key] = Schema.Boolean
      } else {
        optionsMap.set(def.long, { def, key })
        if (def.short) {
          optionsMap.set(def.short, { def, key })
        }
        if (def.defaultValue !== undefined) {
          optionsFields[key] = Schema.optionalWith(def.schema, {
            default: () => def.defaultValue as any
          }) as any
        } else {
          optionsFields[key] = def.schema
        }
      }
    }
  }

  const args = config.arguments ?? []

  const argSchemas = args.map((arg) => arg.schema)

  return {
    name: config.name,
    description: config.description,
    version: config.version,
    flagsMap,
    optionsMap,
    arguments: args,
    optionsSchema: Schema.Struct(optionsFields) as any,
    argumentsSchema: argSchemas.length > 0
      ? (Schema.Tuple(...argSchemas as any) as any)
      : (Schema.Tuple() as any)
  }
}

interface ParsedArgs {
  readonly flags: Record<string, boolean>
  readonly options: Record<string, string>
  readonly positional: ReadonlyArray<string>
}

const parseRawArgs = (
  args: ReadonlyArray<string>
): Effect.Effect<ParsedArgs, CommanderError> =>
  Effect.gen(function* () {
    const flags: Record<string, boolean> = {}
    const options: Record<string, string> = {}
    const positional: Array<string> = []

    let i = 0
    while (i < args.length) {
      const arg = args[i]!

      if (arg === "--") {
        positional.push(...args.slice(i + 1))
        break
      }

      if (arg.startsWith("--")) {
        const equalIndex = arg.indexOf("=")
        if (equalIndex !== -1) {
          const key = arg.slice(2, equalIndex)
          const value = arg.slice(equalIndex + 1)
          options[key] = value
        } else {
          const key = arg.slice(2)
          if (i + 1 < args.length && !args[i + 1]!.startsWith("-")) {
            options[key] = args[i + 1]!
            i++
          } else {
            flags[key] = true
          }
        }
      } else if (arg.startsWith("-") && arg.length > 1) {
        const chars = arg.slice(1)
        for (let j = 0; j < chars.length; j++) {
          const char = chars[j]!
          if (j === chars.length - 1 && i + 1 < args.length && !args[i + 1]!.startsWith("-")) {
            options[char] = args[i + 1]!
            i++
          } else {
            flags[char] = true
          }
        }
      } else {
        positional.push(arg)
      }

      i++
    }

    return { flags, options, positional }
  })

export interface ParseResult<Opts, Args> {
  readonly options: Opts
  readonly arguments: Args
}

export const parse = <Opts, Args>(
  cmd: Command<Opts, Args>,
  args: ReadonlyArray<string>
): Effect.Effect<ParseResult<Opts, Args>, CommanderError> =>
  Effect.gen(function* () {
    const parsed = yield* parseRawArgs(args)

    if (parsed.flags["help"] || parsed.flags["h"]) {
      const help = generateHelp(cmd)
      console.log(help)
      return yield* Effect.fail(
        new CommanderError({ message: "Help requested" })
      )
    }

    if (parsed.flags["version"] || parsed.flags["V"]) {
      if (cmd.version) {
        console.log(`${cmd.name} v${cmd.version}`)
      } else {
        console.log(cmd.name)
      }
      return yield* Effect.fail(
        new CommanderError({ message: "Version requested" })
      )
    }

    const optionsData: Record<string, any> = {}

    for (const [flagKey, fieldName] of cmd.flagsMap) {
      if (parsed.flags[flagKey]) {
        optionsData[fieldName] = true
      } else if (!(fieldName in optionsData)) {
        optionsData[fieldName] = false
      }
    }

    const processedOptions = new Set<string>()

    for (const [optKey, { def, key }] of cmd.optionsMap) {
      if (processedOptions.has(key)) {
        continue
      }
      processedOptions.add(key)

      if (parsed.options[optKey]) {
        const value = parsed.options[optKey]!
        const decoded = yield* Schema.decode(def.schema)(value).pipe(
          Effect.mapError(
            (error) =>
              new CommanderError({
                message: `Invalid value for option --${def.long}: ${error.message}`,
                cause: error
              })
          )
        )
        optionsData[key] = decoded
      } else {
        const allKeys = [...cmd.optionsMap.entries()]
          .filter(([_, v]) => v.key === key)
          .map(([k]) => k)

        const foundKey = allKeys.find((k) => parsed.options[k])
        if (foundKey) {
          const value = parsed.options[foundKey]!
          const decoded = yield* Schema.decode(def.schema)(value).pipe(
            Effect.mapError(
              (error) =>
                new CommanderError({
                  message: `Invalid value for option --${def.long}: ${error.message}`,
                  cause: error
                })
            )
          )
          optionsData[key] = decoded
        } else if (def.defaultValue !== undefined) {
          optionsData[key] = def.defaultValue
        }
      }
    }

    const options = optionsData as Opts

    const decodedArgs: Args = yield* Effect.gen(function* () {
      if (cmd.arguments.length === 0) {
        return [] as any
      }

      const results: any[] = []

      for (let i = 0; i < cmd.arguments.length; i++) {
        const arg = cmd.arguments[i]!
        const value = parsed.positional[i]

        if (value === undefined) {
          if (arg.optional) {
            results.push(Option.none())
          } else {
            return yield* Effect.fail(
              new CommanderError({
                message: `Missing required argument: ${arg.name}`
              })
            )
          }
        } else {
          const decoded = yield* Schema.decode(arg.schema)(value).pipe(
            Effect.mapError(
              (error) =>
                new CommanderError({
                  message: `Invalid argument ${arg.name}: ${error.message}`,
                  cause: error
                })
            )
          )
          if (arg.optional) {
            results.push(Option.some(decoded))
          } else {
            results.push(decoded)
          }
        }
      }

      return results as any
    })

    const result: ParseResult<Opts, Args> = {
      options,
      arguments: decodedArgs
    }
    return result
  }) as Effect.Effect<ParseResult<Opts, Args>, CommanderError>

const generateHelp = <Opts, Args>(cmd: Command<Opts, Args>): string => {
  const lines: Array<string> = []

  if (cmd.description) {
    lines.push(cmd.description)
    lines.push("")
  }

  const argUsage = cmd.arguments
    .map((arg) => (arg.optional ? `[${arg.name}]` : `<${arg.name}>`))
    .join(" ")

  lines.push(
    `Usage: ${cmd.name} [options]${argUsage ? " " + argUsage : ""}`
  )
  lines.push("")

  if (cmd.arguments.length > 0) {
    lines.push("Arguments:")
    for (const arg of cmd.arguments) {
      const name = arg.optional ? `[${arg.name}]` : `<${arg.name}>`
      lines.push(`  ${name.padEnd(20)} ${arg.description}`)
    }
    lines.push("")
  }

  const hasOptions = cmd.flagsMap.size > 0 || cmd.optionsMap.size > 0

  if (hasOptions) {
    lines.push("Options:")

    const flagsDone = new Set<string>()
    for (const [flagKey, fieldName] of cmd.flagsMap) {
      if (flagsDone.has(fieldName)) continue
      flagsDone.add(fieldName)

      const flagEntries = [...cmd.flagsMap.entries()].filter(
        ([_, fn]) => fn === fieldName
      )
      const longFlag = flagEntries.find(([k]) => k.length > 1)?.[0]
      const shortFlag = flagEntries.find(([k]) => k.length === 1)?.[0]

      const short = shortFlag ? `-${shortFlag}, ` : "    "
      const long = longFlag ? `--${longFlag}` : ""
      lines.push(`  ${short}${long.padEnd(16)} Enable ${fieldName}`)
    }

    const optionsDone = new Set<string>()
    for (const [optKey, { def, key }] of cmd.optionsMap) {
      if (optionsDone.has(key)) continue
      optionsDone.add(key)

      const optEntries = [...cmd.optionsMap.entries()].filter(
        ([_, v]) => v.key === key
      )
      const longOpt = optEntries.find(([k]) => k.length > 1)?.[0]
      const shortOpt = optEntries.find(([k]) => k.length === 1)?.[0]

      const short = shortOpt ? `-${shortOpt}, ` : "    "
      const name = longOpt ? `--${longOpt} <value>` : ""
      lines.push(`  ${short}${name.padEnd(16)} ${def.description}`)
    }

    lines.push("  -h, --help           Show this help message")
    if (cmd.version) {
      lines.push("  -V, --version        Show version number")
    }
  }

  return lines.join("\n")
}

export const help = <Opts, Args>(cmd: Command<Opts, Args>): string =>
  generateHelp(cmd)

export const NumberFromString = Schema.NumberFromString

export const BooleanFromString = Schema.transformOrFail(
  Schema.String,
  Schema.Boolean,
  {
    strict: true,
    decode: (s, _, ast) =>
      Effect.gen(function* () {
        const lower = String.toLowerCase(s)
        if (lower === "true" || lower === "1" || lower === "yes") {
          return true
        }
        if (lower === "false" || lower === "0" || lower === "no") {
          return false
        }
        return yield* Effect.fail({
          _tag: "Type" as const,
          ast,
          actual: s,
          message: `Cannot convert "${s}" to boolean`
        })
      }),
    encode: (b, _, ast) => Effect.succeed(b ? "true" : "false")
  }
)

export const choice = <const Choices extends ReadonlyArray<string>>(
  choices: Choices
): Schema.Schema<Choices[number], string> =>
  Schema.Literal(...choices)

export const repeatable = <A>(
  schema: Schema.Schema<A, string>
): Schema.Schema<ReadonlyArray<A>, string> =>
  Schema.transform(Schema.String, Schema.Array(Schema.String), {
    strict: true,
    decode: (s) => s.split(",").map((part) => part.trim()),
    encode: (arr) => arr.join(",")
  }).pipe(
    Schema.compose(Schema.Array(schema))
  ) as any
