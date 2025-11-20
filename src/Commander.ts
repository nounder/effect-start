import * as Data from "effect/Data"
import * as Effect from "effect/Effect"
import * as Option from "effect/Option"
import * as Pipeable from "effect/Pipeable"
import * as Predicate from "effect/Predicate"
import * as Schema from "effect/Schema"
import * as String from "effect/String"

export class CommanderError extends Data.TaggedError("CommanderError")<{
  message: string
  cause?: unknown
}> {}

const TypeId: unique symbol = Symbol.for("effect-start/Commander")

type Self =
  | CommanderSet.Default
  | CommanderSet<any, any, any>
  | typeof import("./Commander.ts")
  | undefined

export interface OptionDef<A = any, Name extends string = string> {
  readonly _tag: "OptionDef"
  readonly name: Name
  readonly long: string
  readonly short?: string
  readonly description: string
  readonly schema?: Schema.Schema<A, string>
  readonly defaultValue?: A
}

export interface SubcommandDef<Handled extends boolean = boolean> {
  readonly _tag: "SubcommandDef"
  readonly command: CommanderSet<any, any, Handled>
}

export type CommandOptions = Record<string, OptionDef<any, string>>

export type ExtractOptionValues<Opts extends CommandOptions> = {
  [K in keyof Opts]: Opts[K] extends OptionDef<infer A, any> ? A : never
}

type CommanderBuilder = {
  option: typeof option
  optionHelp: typeof optionHelp
  optionVersion: typeof optionVersion
  subcommand: typeof subcommand
  handle: typeof handle
}

export type CommanderSet<
  Opts extends CommandOptions = {},
  Subcommands extends ReadonlyArray<SubcommandDef> = [],
  Handled extends boolean = false,
> =
  & Pipeable.Pipeable
  & CommanderSet.Instance<Opts, Subcommands, Handled>
  & {
    [TypeId]: typeof TypeId
  }
  & CommanderBuilder

export namespace CommanderSet {
  export type Instance<
    Opts extends CommandOptions = {},
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

export const option = function<
  S extends Self,
  const Long extends string,
  const Short extends string | undefined = undefined,
>(
  this: S,
  long: Long,
  short?: Short
): OptionBuilder<S, Long, Short> {
  const baseName = this && typeof this === "object" && "name" in this
    ? (this as any).name
    : ""
  const baseOptions = this && typeof this === "object" && "options" in this
    ? (this as any).options
    : {}
  const baseSubcommands = this && typeof this === "object" && "subcommands" in this
    ? (this as any).subcommands
    : []
  const baseDescription = this && typeof this === "object" && "description" in this
    ? (this as any).description
    : undefined
  const baseVersion = this && typeof this === "object" && "version" in this
    ? (this as any).version
    : undefined

  const longName = long.startsWith("--") ? long.slice(2) : long
  const shortName = short?.startsWith("-") ? short.slice(1) : short

  return {
    schema: <A>(schema: Schema.Schema<A, string>) => {
      const optionDef: OptionDef<A, typeof longName> = {
        _tag: "OptionDef",
        name: longName,
        long: longName,
        short: shortName,
        description: "",
        schema
      }

      return makeSet({
        name: baseName,
        description: baseDescription,
        version: baseVersion,
        options: {
          ...baseOptions,
          [longName]: optionDef
        } as any,
        subcommands: baseSubcommands
      })
    },

    description: (desc: string) => {
      return {
        schema: <A>(schema: Schema.Schema<A, string>) => {
          const optionDef: OptionDef<A, typeof longName> = {
            _tag: "OptionDef",
            name: longName,
            long: longName,
            short: shortName,
            description: desc,
            schema
          }

          return makeSet({
            name: baseName,
            description: baseDescription,
            version: baseVersion,
            options: {
              ...baseOptions,
              [longName]: optionDef
            } as any,
            subcommands: baseSubcommands
          })
        },

        default: <A>(defaultValue: A) => {
          return {
            schema: <A2 extends A>(schema: Schema.Schema<A2, string>) => {
              const optionDef: OptionDef<A2, typeof longName> = {
                _tag: "OptionDef",
                name: longName,
                long: longName,
                short: shortName,
                description: desc,
                schema,
                defaultValue: defaultValue as A2
              }

              return makeSet({
                name: baseName,
                description: baseDescription,
                version: baseVersion,
                options: {
                  ...baseOptions,
                  [longName]: optionDef
                } as any,
                subcommands: baseSubcommands
              })
            }
          }
        }
      }
    },

    default: <A>(defaultValue: A) => {
      return {
        schema: <A2 extends A>(schema: Schema.Schema<A2, string>) => {
          const optionDef: OptionDef<A2, typeof longName> = {
            _tag: "OptionDef",
            name: longName,
            long: longName,
            short: shortName,
            description: "",
            schema,
            defaultValue: defaultValue as A2
          }

          return makeSet({
            name: baseName,
            description: baseDescription,
            version: baseVersion,
            options: {
              ...baseOptions,
              [longName]: optionDef
            } as any,
            subcommands: baseSubcommands
          })
        },

        description: (desc: string) => {
          return {
            schema: <A2 extends A>(schema: Schema.Schema<A2, string>) => {
              const optionDef: OptionDef<A2, typeof longName> = {
                _tag: "OptionDef",
                name: longName,
                long: longName,
                short: shortName,
                description: desc,
                schema,
                defaultValue: defaultValue as A2
              }

              return makeSet({
                name: baseName,
                description: baseDescription,
                version: baseVersion,
                options: {
                  ...baseOptions,
                  [longName]: optionDef
                } as any,
                subcommands: baseSubcommands
              })
            }
          }
        }
      }
    }
  } as any
}

export type OptionBuilder<
  S,
  Long extends string,
  Short extends string | undefined,
> = {
  schema<A>(
    schema: Schema.Schema<A, string>
  ): S extends CommanderSet<infer Opts, infer Subs, infer _H>
    ? CommanderSet<
      & Opts
      & {
        [K in Long]: OptionDef<
          A,
          Long
        >
      },
      Subs,
      false
    >
    : CommanderSet<
      {
        [K in Long]: OptionDef<A, Long>
      },
      [],
      false
    >

  description(
    desc: string
  ): {
    schema<A>(
      schema: Schema.Schema<A, string>
    ): S extends CommanderSet<infer Opts, infer Subs, infer _H>
      ? CommanderSet<
        & Opts
        & {
          [K in Long]: OptionDef<A, Long>
        },
        Subs,
        false
      >
      : CommanderSet<
        {
          [K in Long]: OptionDef<A, Long>
        },
        [],
        false
      >

    default<A>(
      defaultValue: A
    ): {
      schema<A2 extends A>(
        schema: Schema.Schema<A2, string>
      ): S extends CommanderSet<infer Opts, infer Subs, infer _H>
        ? CommanderSet<
          & Opts
          & {
            [K in Long]: OptionDef<A2, Long>
          },
          Subs,
          false
        >
        : CommanderSet<
          {
            [K in Long]: OptionDef<A2, Long>
          },
          [],
          false
        >
    }
  }

  default<A>(
    defaultValue: A
  ): {
    schema<A2 extends A>(
      schema: Schema.Schema<A2, string>
    ): S extends CommanderSet<infer Opts, infer Subs, infer _H>
      ? CommanderSet<
        & Opts
        & {
          [K in Long]: OptionDef<A2, Long>
        },
        Subs,
        false
      >
      : CommanderSet<
        {
          [K in Long]: OptionDef<A2, Long>
        },
        [],
        false
      >

    description(
      desc: string
    ): {
      schema<A2 extends A>(
        schema: Schema.Schema<A2, string>
      ): S extends CommanderSet<infer Opts, infer Subs, infer _H>
        ? CommanderSet<
          & Opts
          & {
            [K in Long]: OptionDef<A2, Long>
          },
          Subs,
          false
        >
        : CommanderSet<
          {
            [K in Long]: OptionDef<A2, Long>
          },
          [],
          false
        >
    }
  }
}

export const optionHelp = function<S extends Self>(
  this: S
): S extends CommanderSet<infer Opts, infer Subs, infer _H>
  ? CommanderSet<
    & Opts
    & {
      help: OptionDef<boolean, "help">
    },
    Subs,
    false
  >
  : CommanderSet<
    {
      help: OptionDef<boolean, "help">
    },
    [],
    false
  >
{
  const base = this && typeof this === "object" ? this as any : {}
  const baseName = base.name || ""
  const baseOptions = base.options || {}
  const baseSubcommands = base.subcommands || []
  const baseDescription = base.description
  const baseVersion = base.version

  const helpOption: OptionDef<boolean, "help"> = {
    _tag: "OptionDef",
    name: "help",
    long: "help",
    short: "h",
    description: "Show help information",
    defaultValue: false
  }

  return makeSet({
    name: baseName,
    description: baseDescription,
    version: baseVersion,
    options: {
      ...baseOptions,
      help: helpOption
    } as any,
    subcommands: baseSubcommands
  }) as any
}

export const optionVersion = function<S extends Self>(
  this: S
): S extends CommanderSet<infer Opts, infer Subs, infer _H>
  ? CommanderSet<
    & Opts
    & {
      version: OptionDef<boolean, "version">
    },
    Subs,
    false
  >
  : CommanderSet<
    {
      version: OptionDef<boolean, "version">
    },
    [],
    false
  >
{
  const base = this && typeof this === "object" ? this as any : {}
  const baseName = base.name || ""
  const baseOptions = base.options || {}
  const baseSubcommands = base.subcommands || []
  const baseDescription = base.description
  const baseVersion = base.version

  const versionOption: OptionDef<boolean, "version"> = {
    _tag: "OptionDef",
    name: "version",
    long: "version",
    short: "V",
    description: "Show version information",
    defaultValue: false
  }

  return makeSet({
    name: baseName,
    description: baseDescription,
    version: baseVersion,
    options: {
      ...baseOptions,
      version: versionOption
    } as any,
    subcommands: baseSubcommands
  }) as any
}

export const subcommand = function<
  S extends Self,
  SubOpts extends CommandOptions,
  SubSubs extends ReadonlyArray<SubcommandDef>,
  SubHandled extends boolean,
>(
  this: S,
  cmd: CommanderSet<SubOpts, SubSubs, SubHandled>
): S extends CommanderSet<infer Opts, infer Subs, infer _H>
  ? CommanderSet<
    Opts,
    [...Subs, SubcommandDef<SubHandled>],
    false
  >
  : CommanderSet<
    {},
    [SubcommandDef<SubHandled>],
    false
  >
{
  const base = this && typeof this === "object" ? this as any : {}
  const baseName = base.name || ""
  const baseOptions = base.options || {}
  const baseSubcommands = base.subcommands || []
  const baseDescription = base.description
  const baseVersion = base.version

  const subDef: SubcommandDef<SubHandled> = {
    _tag: "SubcommandDef",
    command: cmd
  }

  return makeSet({
    name: baseName,
    description: baseDescription,
    version: baseVersion,
    options: baseOptions,
    subcommands: [...baseSubcommands, subDef] as any
  }) as any
}

export const handle = function<
  S extends Self,
  Opts extends CommandOptions,
  Subs extends ReadonlyArray<SubcommandDef>,
>(
  this: S extends CommanderSet<infer O, infer Su, any> ? CommanderSet<O, Su, false>
    : never,
  handler: (
    args: S extends CommanderSet<infer O, any, any> ? ExtractOptionValues<O> : never
  ) => Effect.Effect<void>
): S extends CommanderSet<infer O, infer Su, any>
  ? CommanderSet<O, Su, true>
  : never
{
  const base = this && typeof this === "object" ? this as any : {}

  return makeSet({
    name: base.name || "",
    description: base.description,
    version: base.version,
    options: base.options || {},
    subcommands: base.subcommands || [],
    handler: handler as any
  }) as any
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
    subcommands: []
  })

const CommanderProto = {
  [TypeId]: TypeId,

  option,
  optionHelp,
  optionVersion,
  subcommand,
  handle,

  pipe() {
    return Pipeable.pipeArguments(this, arguments)
  }
} satisfies CommanderSet.Proto

function makeSet<
  Opts extends CommandOptions,
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
  return Object.assign(
    Object.create(CommanderProto),
    config
  ) as CommanderSet<Opts, Subs, Handled>
}

export function isCommanderSet(
  input: unknown
): input is CommanderSet<any, any, any> {
  return Predicate.hasProperty(input, TypeId)
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
          if (
            j === chars.length - 1 && i + 1 < args.length &&
            !args[i + 1]!.startsWith("-")
          ) {
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
  Opts extends CommandOptions,
  Subs extends ReadonlyArray<SubcommandDef>,
  Handled extends boolean,
>(
  cmd: CommanderSet<Opts, Subs, Handled>,
  args: ReadonlyArray<string>
): Effect.Effect<ExtractOptionValues<Opts>, CommanderError> =>
  Effect.gen(function* () {
    const parsed = yield* parseRawArgs(args)

    const optionsData: Record<string, any> = {}

    for (const [key, optDef] of Object.entries(cmd.options)) {
      const longMatch = parsed.options[optDef.long] || parsed.flags[optDef.long]
      const shortMatch = optDef.short
        ? (parsed.options[optDef.short] || parsed.flags[optDef.short])
        : undefined

      const rawValue = longMatch ?? shortMatch

      if (rawValue !== undefined) {
        if (typeof rawValue === "boolean") {
          optionsData[key] = rawValue
        } else if (optDef.schema) {
          const decoded = yield* Schema.decode(optDef.schema)(rawValue).pipe(
            Effect.mapError(
              (error) =>
                new CommanderError({
                  message: `Invalid value for option --${optDef.long}: ${error.message}`,
                  cause: error
                })
            )
          )
          optionsData[key] = decoded
        } else {
          optionsData[key] = rawValue
        }
      } else if (optDef.defaultValue !== undefined) {
        optionsData[key] = optDef.defaultValue
      }
    }

    return optionsData as ExtractOptionValues<Opts>
  })

export const runMain = <
  Opts extends CommandOptions,
  Subs extends ReadonlyArray<SubcommandDef>,
>(
  cmd: CommanderSet<Opts, Subs, true>
): Effect.Effect<void, CommanderError> =>
  Effect.gen(function* () {
    const args = typeof process !== "undefined" ? process.argv.slice(2) : []

    const parsedOptions = yield* parse(cmd, args)

    if ((parsedOptions as any).help) {
      console.log(generateHelp(cmd))
      return
    }

    if ((parsedOptions as any).version && cmd.version) {
      console.log(`${cmd.name} v${cmd.version}`)
      return
    }

    if (cmd.handler) {
      yield* cmd.handler(parsedOptions)
    }
  })

const generateHelp = <
  Opts extends CommandOptions,
  Subs extends ReadonlyArray<SubcommandDef>,
  Handled extends boolean,
>(cmd: CommanderSet<Opts, Subs, Handled>): string => {
  const lines: Array<string> = []

  if (cmd.description) {
    lines.push(cmd.description)
    lines.push("")
  }

  lines.push(`Usage: ${cmd.name} [options]`)
  lines.push("")

  const optionsList = Object.values(cmd.options)

  if (optionsList.length > 0) {
    lines.push("Options:")

    for (const opt of optionsList) {
      const short = opt.short ? `-${opt.short}, ` : "    "
      const long = `--${opt.long}`
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
  Opts extends CommandOptions,
  Subs extends ReadonlyArray<SubcommandDef>,
  Handled extends boolean,
>(cmd: CommanderSet<Opts, Subs, Handled>): string => generateHelp(cmd)

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
): Schema.Schema<Choices[number], string> => Schema.Literal(...choices)

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
