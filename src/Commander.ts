import * as Data from "effect/Data"
import * as Effect from "effect/Effect"
import * as Pipeable from "effect/Pipeable"
import * as Predicate from "effect/Predicate"
import * as Schema from "effect/Schema"

export class CommanderError extends Data.TaggedError("CommanderError")<{
  message: string
  cause?: unknown
}> {}

const TypeId: unique symbol = Symbol.for("effect-start/Commander")

type KebabToCamel<S extends string> = S extends `${infer First}-${infer Rest}`
  ? `${First}${KebabToCamel<Capitalize<Rest>>}`
  : S

type StripPrefix<S extends string> = S extends `--${infer Name}`
  ? Name
  : S extends `-${infer Name}`
    ? Name
    : S

type OptionNameToCamelCase<S extends string> = KebabToCamel<StripPrefix<S>>

export interface OptionBuilder<A = any, Name extends string = string> {
  readonly _tag: "OptionBuilder"
  readonly name: Name
  readonly long: Name
  readonly short?: string
  readonly description: string
  readonly schema?: Schema.Schema<A, any>
  readonly defaultValue?: A
}

type OptionBuilderWithSchema<A, Name extends string> = Omit<
  OptionBuilder<A, Name>,
  "schema" | "defaultValue"
> & {
  readonly schema: Schema.Schema<A, any>
  readonly defaultValue?: A
}

export const option = <
  const Long extends `--${string}`,
  const Short extends `-${string}` | undefined = undefined,
>(
  long: Long,
  short?: Short,
): {
  // Using exact `string` would reject schemas with literal encoded types,
  // like in case of Schema.BooleanFromString.
  schema<A, I extends string = string>(
    schema: Schema.Schema<A, I>,
  ): OptionBuilderWithSchema<A, Long>

  description(desc: string): {
    schema<A, I extends string = string>(
      schema: Schema.Schema<A, I>,
    ): OptionBuilderWithSchema<A, Long>

    default<A>(value: A): {
      schema<A2 extends A, I extends string = string>(
        schema: Schema.Schema<A2, I>,
      ): OptionBuilderWithSchema<A2, Long>
    }
  }

  default<A>(value: A): {
    schema<A2 extends A, I extends string = string>(
      schema: Schema.Schema<A2, I>,
    ): OptionBuilderWithSchema<A2, Long>

    description(desc: string): {
      schema<A2 extends A, I extends string = string>(
        schema: Schema.Schema<A2, I>,
      ): OptionBuilderWithSchema<A2, Long>
    }
  }
} => {
  const longName = long
  const shortName = short ? short.slice(1) : undefined

  return {
    schema: <A, I extends string = string>(schema: Schema.Schema<A, I>) => ({
      _tag: "OptionBuilder" as const,
      name: longName,
      long: longName,
      short: shortName,
      description: "",
      schema,
    }),

    description: (desc) => ({
      schema: <A, I extends string = string>(schema: Schema.Schema<A, I>) => ({
        _tag: "OptionBuilder" as const,
        name: longName,
        long: longName,
        short: shortName,
        description: desc,
        schema,
      }),

      default: <A>(value: A) => ({
        schema: <A2 extends A, I extends string = string>(schema: Schema.Schema<A2, I>) => ({
          _tag: "OptionBuilder" as const,
          name: longName,
          long: longName,
          short: shortName,
          description: desc,
          schema,
          defaultValue: value as A2,
        }),
      }),
    }),

    default: <A>(value: A) => ({
      schema: <A2 extends A, I extends string = string>(schema: Schema.Schema<A2, I>) => ({
        _tag: "OptionBuilder" as const,
        name: longName,
        long: longName,
        short: shortName,
        description: "",
        schema,
        defaultValue: value as A2,
      }),

      description: (desc) => ({
        schema: <A2 extends A, I extends string = string>(schema: Schema.Schema<A2, I>) => ({
          _tag: "OptionBuilder" as const,
          name: longName,
          long: longName,
          short: shortName,
          description: desc,
          schema,
          defaultValue: value as A2,
        }),
      }),
    }),
  }
}

export type OptionsMap = Record<string, OptionBuilder<any, any>>

type ExtractOptionsFromBuilders<Opts extends OptionsMap> = {
  [K in keyof Opts as Opts[K] extends OptionBuilder<any, infer Name>
    ? OptionNameToCamelCase<Name>
    : never]: Opts[K] extends OptionBuilder<infer A, any> ? A : never
}

export type ExtractOptionValues<Opts extends OptionsMap> = ExtractOptionsFromBuilders<Opts>

export interface SubcommandDef<Handled extends boolean = boolean> {
  readonly _tag: "SubcommandDef"
  readonly command: CommanderSet<any, any, Handled>
}

type Extend<
  S,
  NewOpts extends OptionsMap,
  NewSubs extends ReadonlyArray<SubcommandDef> = [],
  Handled extends boolean = false,
> =
  S extends CommanderSet<infer Opts, infer Subs, infer _H>
    ? CommanderSet<Opts & NewOpts, [...Subs, ...NewSubs], Handled>
    : CommanderSet<NewOpts, NewSubs, Handled>

type CommanderBuilder = {
  option: typeof optionMethod
  optionHelp: typeof optionHelp
  optionVersion: typeof optionVersion
  subcommand: typeof subcommand
  handle: typeof handle
}

export type CommanderSet<
  Opts extends OptionsMap = {},
  Subcommands extends ReadonlyArray<SubcommandDef> = [],
  Handled extends boolean = false,
> = Pipeable.Pipeable &
  CommanderSet.Instance<Opts, Subcommands, Handled> & {
    [TypeId]: typeof TypeId
  } & CommanderBuilder

export namespace CommanderSet {
  export type Instance<
    Opts extends OptionsMap = {},
    Subcommands extends ReadonlyArray<SubcommandDef> = [],
    Handled extends boolean = false,
  > = {
    readonly name: string
    readonly description?: string
    readonly version?: string
    readonly options: Opts
    readonly subcommands: Subcommands
    readonly handler?: Handled extends true
      ? (args: ExtractOptionValues<Opts>) => Effect.Effect<void>
      : never
  }

  export type Default = CommanderSet<{}, [], false>

  export type Proto = {
    [TypeId]: typeof TypeId
    pipe(): any
  } & CommanderBuilder
}

const optionMethod = function <S, Opt extends OptionBuilder<any, any>>(
  this: S,
  opt: Opt,
): Extend<S, { [K in Opt["name"] as OptionNameToCamelCase<K>]: Opt }> {
  const base = (this && typeof this === "object" ? this : {}) as Partial<CommanderSet.Instance>
  const baseName = base.name ?? ""
  const baseOptions: OptionsMap = base.options ?? {}
  const baseSubcommands = base.subcommands ?? []
  const baseDescription = base.description
  const baseVersion = base.version

  const camelKey = kebabToCamel(stripPrefix(opt.long))

  return makeSet({
    name: baseName,
    description: baseDescription,
    version: baseVersion,
    options: { ...baseOptions, [camelKey]: opt },
    subcommands: baseSubcommands,
  }) as Extend<S, { [K in Opt["name"] as OptionNameToCamelCase<K>]: Opt }>
}

export const optionHelp = function <S>(
  this: S,
): Extend<S, { help: OptionBuilder<boolean, "--help"> }> {
  const base = (this && typeof this === "object" ? this : {}) as Partial<CommanderSet.Instance>
  const baseName = base.name ?? ""
  const baseOptions: OptionsMap = base.options ?? {}
  const baseSubcommands = base.subcommands ?? []
  const baseDescription = base.description
  const baseVersion = base.version

  const helpOption: OptionBuilder<boolean, "--help"> = {
    _tag: "OptionBuilder",
    name: "--help",
    long: "--help",
    short: "h",
    description: "Show help information",
    defaultValue: false,
  }

  return makeSet({
    name: baseName,
    description: baseDescription,
    version: baseVersion,
    options: { ...baseOptions, help: helpOption },
    subcommands: baseSubcommands,
  }) as Extend<S, { help: OptionBuilder<boolean, "--help"> }>
}

export const optionVersion = function <S>(
  this: S,
): Extend<S, { version: OptionBuilder<boolean, "--version"> }> {
  const base = (this && typeof this === "object" ? this : {}) as Partial<CommanderSet.Instance>
  const baseName = base.name ?? ""
  const baseOptions: OptionsMap = base.options ?? {}
  const baseSubcommands = base.subcommands ?? []
  const baseDescription = base.description
  const baseVersion = base.version

  const versionOption: OptionBuilder<boolean, "--version"> = {
    _tag: "OptionBuilder",
    name: "--version",
    long: "--version",
    short: "V",
    description: "Show version information",
    defaultValue: false,
  }

  return makeSet({
    name: baseName,
    description: baseDescription,
    version: baseVersion,
    options: { ...baseOptions, version: versionOption },
    subcommands: baseSubcommands,
  }) as Extend<S, { version: OptionBuilder<boolean, "--version"> }>
}

export const subcommand = function <
  S,
  SubOpts extends OptionsMap,
  SubSubs extends ReadonlyArray<SubcommandDef>,
  SubHandled extends boolean,
>(
  this: S,
  cmd: CommanderSet<SubOpts, SubSubs, SubHandled>,
): Extend<S, {}, [SubcommandDef<SubHandled>]> {
  const base = (this && typeof this === "object" ? this : {}) as Partial<CommanderSet.Instance>
  const baseName = base.name ?? ""
  const baseOptions = base.options ?? {}
  const baseSubcommands = base.subcommands ?? []
  const baseDescription = base.description
  const baseVersion = base.version

  const subDef: SubcommandDef<SubHandled> = {
    _tag: "SubcommandDef",
    command: cmd,
  }

  return makeSet({
    name: baseName,
    description: baseDescription,
    version: baseVersion,
    options: baseOptions,
    subcommands: [...baseSubcommands, subDef],
  }) as Extend<S, {}, [SubcommandDef<SubHandled>]>
}

export const handle = function <Opts extends OptionsMap, Subs extends ReadonlyArray<SubcommandDef>>(
  this: CommanderSet<Opts, Subs, false>,
  handler: (args: ExtractOptionValues<Opts>) => Effect.Effect<void>,
): CommanderSet<Opts, Subs, true> {
  const base = this as CommanderSet.Instance<Opts, Subs, false>

  return makeSet<Opts, Subs, true>({
    name: base.name,
    description: base.description,
    version: base.version,
    options: base.options,
    subcommands: base.subcommands,
    handler,
  })
}

export const make = <const Name extends string>(config: {
  readonly name: Name
  readonly description?: string
  readonly version?: string
}): CommanderSet<{}, [], false> =>
  makeSet({
    name: config.name,
    description: config.description,
    version: config.version,
    options: {},
    subcommands: [],
  })

const CommanderProto = {
  [TypeId]: TypeId,

  option: optionMethod,
  optionHelp,
  optionVersion,
  subcommand,
  handle,

  pipe() {
    return Pipeable.pipeArguments(this, arguments)
  },
} satisfies CommanderSet.Proto

function makeSet<
  Opts extends OptionsMap,
  Subs extends ReadonlyArray<SubcommandDef>,
  Handled extends boolean = false,
>(config: {
  readonly name: string
  readonly description?: string
  readonly version?: string
  readonly options: Opts
  readonly subcommands: Subs
  readonly handler?: (args: ExtractOptionValues<Opts>) => Effect.Effect<void>
}): CommanderSet<Opts, Subs, Handled> {
  return Object.assign(Object.create(CommanderProto), config) as CommanderSet<Opts, Subs, Handled>
}

export function isCommanderSet(input: unknown): input is CommanderSet<any, any, any> {
  return Predicate.hasProperty(input, TypeId)
}

const kebabToCamel = (str: string): string => {
  return str.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())
}

const stripPrefix = (str: string): string => {
  if (str.startsWith("--")) return str.slice(2)
  if (str.startsWith("-")) return str.slice(1)
  return str
}

interface ParsedArgs {
  readonly flags: Record<string, boolean>
  readonly options: Record<string, string>
  readonly positional: ReadonlyArray<string>
}

const parseRawArgs = (args: ReadonlyArray<string>): Effect.Effect<ParsedArgs, CommanderError> =>
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

export const parse = <
  Opts extends OptionsMap,
  Subs extends ReadonlyArray<SubcommandDef>,
  Handled extends boolean,
>(
  cmd: CommanderSet<Opts, Subs, Handled>,
  args: ReadonlyArray<string>,
): Effect.Effect<ExtractOptionValues<Opts>, CommanderError> =>
  Effect.gen(function* () {
    const parsed = yield* parseRawArgs(args)

    const result: Record<string, any> = {}

    for (const optBuilder of Object.values(cmd.options)) {
      const longName = stripPrefix(optBuilder.long)
      const shortName = optBuilder.short

      const longMatch = parsed.options[longName] || parsed.flags[longName]
      const shortMatch = shortName
        ? parsed.options[shortName] || parsed.flags[shortName]
        : undefined

      const rawValue = longMatch ?? shortMatch

      const camelKey = kebabToCamel(stripPrefix(optBuilder.long))

      if (rawValue !== undefined) {
        if (typeof rawValue === "boolean") {
          result[camelKey] = rawValue
        } else if (optBuilder.schema) {
          const decoded = yield* Schema.decode(optBuilder.schema)(rawValue).pipe(
            Effect.mapError(
              (error) =>
                new CommanderError({
                  message: `Invalid value for option ${optBuilder.long}: ${error.message}`,
                  cause: error,
                }),
            ),
          )
          result[camelKey] = decoded
        } else {
          result[camelKey] = rawValue
        }
      } else if (optBuilder.defaultValue !== undefined) {
        result[camelKey] = optBuilder.defaultValue
      }
    }

    return result as ExtractOptionValues<Opts>
  })

export const runMain = <Opts extends OptionsMap, Subs extends ReadonlyArray<SubcommandDef>>(
  cmd: CommanderSet<Opts, Subs, true>,
): Effect.Effect<void, CommanderError> =>
  Effect.gen(function* () {
    const args = typeof process !== "undefined" ? process.argv.slice(2) : []

    const parsedOptions = yield* parse(cmd, args)

    if (Predicate.hasProperty(parsedOptions, "help") && parsedOptions.help) {
      console.log(generateHelp(cmd))
      return
    }

    if (Predicate.hasProperty(parsedOptions, "version") && parsedOptions.version && cmd.version) {
      console.log(`${cmd.name} v${cmd.version}`)
      return
    }

    if (cmd.handler) {
      yield* cmd.handler(parsedOptions)
    }
  })

const generateHelp = <
  Opts extends OptionsMap,
  Subs extends ReadonlyArray<SubcommandDef>,
  Handled extends boolean,
>(
  cmd: CommanderSet<Opts, Subs, Handled>,
): string => {
  const lines: Array<string> = []

  if (cmd.description) {
    lines.push(cmd.description)
    lines.push("")
  }

  lines.push(`Usage: ${cmd.name} [options]`)
  lines.push("")

  const optionsArray = Object.values(cmd.options)
  if (optionsArray.length > 0) {
    lines.push("Options:")

    for (const opt of optionsArray) {
      const short = opt.short ? `-${opt.short}, ` : "    "
      const long = opt.long
      const hasValue = opt.schema !== undefined
      const name = hasValue ? `${long} <value>` : long
      lines.push(`  ${short}${name.padEnd(20)} ${opt.description}`)
    }

    lines.push("")
  }

  if (cmd.subcommands.length > 0) {
    lines.push("Commands:")
    for (const sub of cmd.subcommands) {
      const subCmd = sub.command
      lines.push(`  ${subCmd.name.padEnd(20)} ${subCmd.description || ""}`)
    }
    lines.push("")
  }

  return lines.join("\n")
}

export const help = <
  Opts extends OptionsMap,
  Subs extends ReadonlyArray<SubcommandDef>,
  Handled extends boolean,
>(
  cmd: CommanderSet<Opts, Subs, Handled>,
): string => generateHelp(cmd)

export const NumberFromString = Schema.NumberFromString

export const choice = <const Choices extends ReadonlyArray<string>>(
  choices: Choices,
): Schema.Schema<Choices[number], string> => Schema.Literal(...choices)

export const repeatable = <A>(
  schema: Schema.Schema<A, string>,
): Schema.Schema<ReadonlyArray<A>, string> =>
  Schema.transform(Schema.String, Schema.Array(Schema.String), {
    strict: true,
    decode: (s) => s.split(",").map((part) => part.trim()),
    encode: (arr) => arr.join(","),
  }).pipe(Schema.compose(Schema.Array(schema)))
