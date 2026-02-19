import * as Console from "effect/Console"
import * as Effect from "effect/Effect"
import { dual } from "effect/Function"
import * as Option from "effect/Option"
import * as Predicate from "effect/Predicate"
import type { Simplify } from "effect/Types"
import { CliError, formatErrors } from "./CliError.ts"
import * as FlagNs from "./Flag.ts"
import type { Flag } from "./Flag.ts"
import type { ArgDoc, FlagDoc, HelpDoc } from "./HelpDoc.ts"
import { formatHelpDoc, formatVersion } from "./HelpDoc.ts"
import type { Param, ParamKind, ParsedArgs, SingleParam } from "./Param.ts"
import { extractSingleParams, getParamMetadata, isFlagParam, isParam } from "./Param.ts"
import * as Primitive from "./Primitive.ts"

type Token =
  | { _tag: "LongOption"; name: string; raw: string; value?: string }
  | { _tag: "ShortOption"; flag: string; raw: string; value?: string }
  | { _tag: "Value"; value: string }

interface LexResult {
  readonly tokens: ReadonlyArray<Token>
  readonly trailingOperands: ReadonlyArray<string>
}

const lex = (argv: ReadonlyArray<string>): LexResult => {
  const endIdx = argv.indexOf("--")
  const args = endIdx === -1 ? argv : argv.slice(0, endIdx)
  const trailing = endIdx === -1 ? [] : argv.slice(endIdx + 1)
  const tokens: Array<Token> = []
  for (const arg of args) {
    if (!arg.startsWith("-")) {
      tokens.push({ _tag: "Value", value: arg })
    } else if (arg.startsWith("--")) {
      const [name, value] = arg.slice(2).split("=", 2)
      tokens.push({ _tag: "LongOption", name, raw: arg, value })
    } else if (arg.length > 1) {
      const flags = arg.slice(1)
      const eq = flags.indexOf("=")
      if (eq !== -1) {
        tokens.push({ _tag: "ShortOption", flag: flags.slice(0, eq), raw: `-${flags.slice(0, eq)}`, value: flags.slice(eq + 1) })
      } else {
        for (const ch of flags) tokens.push({ _tag: "ShortOption", flag: ch, raw: `-${ch}` })
      }
    } else {
      tokens.push({ _tag: "Value", value: arg })
    }
  }
  return { tokens, trailingOperands: trailing }
}

const levenshtein = (a: string, b: string): number => {
  const m = a.length, n = b.length
  const dp: Array<Array<number>> = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0))
  for (let i = 0; i <= m; i++) dp[i][0] = i
  for (let j = 0; j <= n; j++) dp[0][j] = j
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost)
    }
  return dp[m][n]
}

const suggest = (input: string, candidates: ReadonlyArray<string>): ReadonlyArray<string> => {
  const ds = candidates.map((c) => [levenshtein(input, c), c] as const).filter(([d]) => d <= 2).sort(([a], [b]) => a - b)
  if (ds.length === 0) return []
  const min = ds[0][0]
  return ds.filter(([d]) => d === min).map(([, c]) => c)
}

interface ConfigInternal {
  readonly arguments: ReadonlyArray<Param<"argument", any>>
  readonly flags: ReadonlyArray<Param<"flag", any>>
  readonly orderedParams: ReadonlyArray<Param<any, any>>
  readonly tree: ConfigTree
}

type ConfigTree = Record<string, ConfigNode>
type ConfigNode =
  | { readonly _tag: "Param"; readonly index: number }
  | { readonly _tag: "Array"; readonly children: ReadonlyArray<ConfigNode> }
  | { readonly _tag: "Nested"; readonly tree: ConfigTree }

const parseConfig = (config: Record<string, any>): ConfigInternal => {
  const orderedParams: Array<Param<any, any>> = []
  const flags: Array<Param<"flag", any>> = []
  const args: Array<Param<"argument", any>> = []

  const walk = (cfg: Record<string, any>): ConfigTree => {
    const tree: ConfigTree = {}
    for (const key in cfg) tree[key] = walkValue(cfg[key])
    return tree
  }

  const walkValue = (v: any): ConfigNode => {
    if (Array.isArray(v)) return { _tag: "Array", children: v.map(walkValue) }
    if (isParam(v)) {
      const idx = orderedParams.length
      orderedParams.push(v)
      if (v.kind === "argument") args.push(v as any)
      else flags.push(v as any)
      return { _tag: "Param", index: idx }
    }
    return { _tag: "Nested", tree: walk(v) }
  }

  return { flags, arguments: args, orderedParams, tree: walk(config) }
}

const reconstructTree = (tree: ConfigTree, results: ReadonlyArray<any>): Record<string, any> => {
  const out: Record<string, any> = {}
  for (const key in tree) out[key] = nodeValue(tree[key], results)
  return out
}

const nodeValue = (node: ConfigNode, results: ReadonlyArray<any>): any => {
  if (node._tag === "Param") return results[node.index]
  if (node._tag === "Array") return node.children.map((c) => nodeValue(c, results))
  return reconstructTree(node.tree, results)
}

const helpFlag: Flag<boolean> = FlagNs.boolean("help").pipe(FlagNs.withAlias("h"), FlagNs.withDescription("Show help information"))
const versionFlag: Flag<boolean> = FlagNs.boolean("version").pipe(FlagNs.withDescription("Show version information"))
const logLevelFlag: Flag<Option.Option<string>> = FlagNs.choice("log-level", [
  "all", "trace", "debug", "info", "warn", "warning", "error", "fatal", "none",
] as const).pipe(FlagNs.optional, FlagNs.withDescription("Sets the minimum log level"))

interface ParsedTokens {
  readonly flags: Record<string, ReadonlyArray<string>>
  readonly arguments: ReadonlyArray<string>
  readonly errors?: ReadonlyArray<CliError>
  readonly subcommand?: { readonly name: string; readonly parsedInput: ParsedTokens }
}

type FlagParam = SingleParam<"flag", unknown>
type FlagMap = Record<string, Array<string>>
type FlagRegistry = { params: ReadonlyArray<FlagParam>; index: Map<string, FlagParam> }

const createFlagRegistry = (params: ReadonlyArray<FlagParam>): FlagRegistry => {
  const index = new Map<string, FlagParam>()
  for (const p of params) {
    index.set(p.name, p)
    for (const a of p.aliases) index.set(a, p)
  }
  return { params, index }
}

const createEmptyFlagMap = (params: ReadonlyArray<FlagParam>): FlagMap =>
  Object.fromEntries(params.map((p) => [p.name, []]))

type FlagToken = Extract<Token, { _tag: "LongOption" | "ShortOption" }>
const isFlagToken = (t: Token): t is FlagToken => t._tag === "LongOption" || t._tag === "ShortOption"
const getFlagName = (t: FlagToken): string => t._tag === "LongOption" ? t.name : t.flag

const consumeFlagValue = (
  tokens: ReadonlyArray<Token>, i: number, token: FlagToken, spec: FlagParam,
): { value: string | undefined; skip: number } => {
  if (token.value !== undefined) return { value: token.value, skip: 0 }
  if (Primitive.isBoolean(spec.primitiveType)) {
    const next = tokens[i + 1]
    if (next?._tag === "Value" && Primitive.isBooleanLiteral(next.value)) return { value: next.value, skip: 1 }
    return { value: "true", skip: 0 }
  }
  const next = tokens[i + 1]
  if (next?._tag === "Value") return { value: next.value, skip: 1 }
  return { value: undefined, skip: 0 }
}

const consumeKnownFlags = (
  tokens: ReadonlyArray<Token>, registry: FlagRegistry,
): { flagMap: FlagMap; remainder: ReadonlyArray<Token> } => {
  const flagMap = createEmptyFlagMap(registry.params)
  const remainder: Array<Token> = []
  let i = 0
  while (i < tokens.length) {
    const t = tokens[i]
    if (!isFlagToken(t)) { remainder.push(t); i++; continue }
    const spec = registry.index.get(getFlagName(t))
    if (!spec) { remainder.push(t); i++; continue }
    const { value, skip } = consumeFlagValue(tokens, i, t, spec)
    if (value !== undefined) flagMap[spec.name].push(value)
    i += 1 + skip
  }
  return { flagMap, remainder }
}

const builtInParams: ReadonlyArray<FlagParam> = [
  ...extractSingleParams(helpFlag) as FlagParam[],
  ...extractSingleParams(versionFlag) as FlagParam[],
  ...extractSingleParams(logLevelFlag) as FlagParam[],
]
const builtInRegistry = createFlagRegistry(builtInParams)

const extractBuiltInOptions = (tokens: ReadonlyArray<Token>): Effect.Effect<{
  help: boolean; version: boolean; logLevel: Option.Option<string>; remainder: ReadonlyArray<Token>
}, CliError> =>
  Effect.gen(function*() {
    const { flagMap, remainder } = consumeKnownFlags(tokens, builtInRegistry)
    const emptyArgs: ParsedArgs = { flags: flagMap, arguments: [] }
    const [, help] = yield* helpFlag.parse(emptyArgs)
    const [, version] = yield* versionFlag.parse(emptyArgs)
    const [, logLevel] = yield* logLevelFlag.parse(emptyArgs)
    return { help, version, logLevel, remainder }
  })

const parseArgs = (
  lexResult: LexResult, command: Command<any, any, any, any>, commandPath: ReadonlyArray<string> = [],
): Effect.Effect<ParsedTokens, CliError> =>
  Effect.gen(function*() {
    const impl = toImpl(command)
    const singles = impl.config.flags.flatMap(extractSingleParams) as FlagParam[]
    const flagRegistry = createFlagRegistry(singles.filter(isFlagParam))
    const newPath = [...commandPath, command.name]
    const { tokens, trailingOperands } = lexResult

    const flagMap = createEmptyFlagMap(flagRegistry.params)
    const errors: Array<CliError> = []
    const args: Array<string> = []
    let mode: "awaiting" | "collecting" = "awaiting"
    let subResult: { sub: Command<any, any, any, any>; childTokens: ReadonlyArray<Token> } | undefined
    let i = 0

    while (i < tokens.length) {
      const t = tokens[i]
      if (isFlagToken(t)) {
        const spec = flagRegistry.index.get(getFlagName(t))
        if (!spec) {
          const validNames: Array<string> = []
          for (const p of flagRegistry.params) { validNames.push(p.name); for (const a of p.aliases) validNames.push(a) }
          const sug = suggest(getFlagName(t), validNames).map((n) => n.length === 1 ? `-${n}` : `--${n}`)
          errors.push(new CliError({ reason: "UnrecognizedOption", option: t._tag === "LongOption" ? `--${t.name}` : `-${t.flag}`, suggestions: sug, command: newPath }))
          i++; continue
        }
        const { value, skip } = consumeFlagValue(tokens, i, t, spec)
        if (value !== undefined) flagMap[spec.name].push(value)
        i += 1 + skip; continue
      }

      if (t._tag === "Value") {
        if (mode === "awaiting") {
          const subIndex = new Map(command.subcommands.map((s: any) => [s.name, s]))
          const sub = subIndex.get(t.value) as Command<any, any, any, any> | undefined
          if (sub) {
            const tail = consumeKnownFlags(tokens.slice(i + 1), flagRegistry)
            for (const key in tail.flagMap) {
              const vals = tail.flagMap[key]
              if (vals?.length) for (const v of vals) flagMap[key].push(v)
            }
            subResult = { sub, childTokens: tail.remainder }
            break
          }
          const expectsArgs = impl.config.arguments.length > 0
          if (!expectsArgs && command.subcommands.length > 0) {
            const sug = suggest(t.value, command.subcommands.map((s: any) => s.name))
            errors.push(new CliError({ reason: "UnknownSubcommand", subcommand: t.value, parent: newPath, suggestions: sug }))
          }
          mode = "collecting"
        }
        args.push(t.value)
      }
      i++
    }

    if (!subResult) {
      return {
        flags: flagMap,
        arguments: [...args, ...trailingOperands],
        ...(errors.length > 0 && { errors }),
      }
    }

    const subParsed = yield* parseArgs(
      { tokens: subResult.childTokens, trailingOperands: [] },
      subResult.sub, newPath,
    )
    const allErrors = [...errors, ...(subParsed.errors ?? [])]
    return {
      flags: flagMap,
      arguments: trailingOperands,
      subcommand: { name: subResult.sub.name, parsedInput: subParsed },
      ...(allErrors.length > 0 && { errors: allErrors }),
    }
  })

const getCommandPath = (p: ParsedTokens): ReadonlyArray<string> =>
  p.subcommand ? [p.subcommand.name, ...getCommandPath(p.subcommand.parsedInput)] : []

const CommandTypeId = "~effect-start/Cli/Command" as const

export interface Command<Name extends string, Input, E = never, R = never> {
  readonly [CommandTypeId]: typeof CommandTypeId
  readonly name: Name
  readonly description: string | undefined
  readonly subcommands: ReadonlyArray<Command<any, any, any, any>>
}

export declare namespace Command {
  interface Config {
    readonly [key: string]:
      | Param<ParamKind, any>
      | ReadonlyArray<Param<ParamKind, any> | Config>
      | Config
  }

  namespace Config {
    type Infer<A extends Config> = Simplify<{ readonly [K in keyof A]: InferValue<A[K]> }>
    type InferValue<A> = A extends ReadonlyArray<any> ? { readonly [K in keyof A]: InferValue<A[K]> }
      : A extends Param<any, infer V> ? V
      : A extends Config ? Infer<A>
      : never
  }

  type Any = Command<string, unknown, unknown, unknown>
}

interface CommandInternal<Name extends string, Input, E, R> extends Command<Name, Input, E, R> {
  readonly config: ConfigInternal
  readonly parse: (input: ParsedTokens) => Effect.Effect<Input, CliError>
  readonly handle: (input: Input, path: ReadonlyArray<string>) => Effect.Effect<void, E | CliError, R>
  readonly buildHelpDoc: (path: ReadonlyArray<string>) => HelpDoc
}

const toImpl = <N extends string, I, E, R>(c: Command<N, I, E, R>): CommandInternal<N, I, E, R> =>
  c as CommandInternal<N, I, E, R>

export const isCommand = (u: unknown): u is Command.Any => Predicate.hasProperty(u, CommandTypeId)

const makeCommandInternal = <N extends string, I, E, R>(opts: {
  name: N
  config: ConfigInternal
  description?: string
  subcommands?: ReadonlyArray<Command<any, any, any, any>>
  parse?: (input: ParsedTokens) => Effect.Effect<I, CliError>
  handle?: (input: I, path: ReadonlyArray<string>) => Effect.Effect<void, E | CliError, R>
}): Command<N, I, E, R> => {
  const config = opts.config

  const handle = (input: I, path: ReadonlyArray<string>): Effect.Effect<void, E | CliError, R> =>
    opts.handle ? opts.handle(input, path) : Effect.fail(new CliError({ reason: "ShowHelp", commandPath: path })) as any

  const parse = opts.parse ?? ((input: ParsedTokens) =>
    Effect.gen(function*() {
      const parsedArgs: ParsedArgs = { flags: input.flags, arguments: input.arguments }
      const values: Array<unknown> = []
      let current = parsedArgs.arguments
      for (const param of config.orderedParams) {
        const [remaining, parsed] = yield* param.parse({ flags: parsedArgs.flags, arguments: current })
        values.push(parsed)
        current = remaining
      }
      return reconstructTree(config.tree, values) as I
    }))

  const buildHelpDoc = (path: ReadonlyArray<string>): HelpDoc => {
    const argDocs: Array<ArgDoc> = []
    for (const arg of config.arguments) {
      const singles = extractSingleParams(arg)
      const meta = getParamMetadata(arg)
      for (const s of singles) {
        argDocs.push({
          name: s.name, type: s.typeName ?? Primitive.getTypeName(s.primitiveType),
          description: s.description, required: !meta.isOptional, variadic: meta.isVariadic,
        })
      }
    }

    let usage = path.length > 0 ? path.join(" ") : opts.name
    const subs = opts.subcommands ?? []
    if (subs.length > 0) usage += " <subcommand>"
    usage += " [flags]"
    for (const a of argDocs) {
      const n = a.variadic ? `<${a.name}...>` : `<${a.name}>`
      usage += ` ${a.required ? n : `[${n}]`}`
    }

    const flagDocs: Array<FlagDoc> = []
    for (const f of config.flags) {
      const singles = extractSingleParams(f)
      for (const s of singles) {
        flagDocs.push({
          name: s.name, aliases: s.aliases.map((a) => a.length === 1 ? `-${a}` : `--${a}`),
          type: s.typeName ?? Primitive.getTypeName(s.primitiveType),
          description: s.description, required: s.primitiveType._tag !== "Boolean",
        })
      }
    }

    return {
      description: opts.description ?? "", usage, flags: flagDocs,
      ...(argDocs.length > 0 && { args: argDocs }),
      ...(subs.length > 0 && { subcommands: subs.map((s) => ({ name: s.name, description: s.description ?? "" })) }),
    }
  }

  return Object.assign(Object.create(null), {
    [CommandTypeId]: CommandTypeId,
    name: opts.name,
    description: opts.description,
    subcommands: opts.subcommands ?? [],
    config, parse, handle, buildHelpDoc,
  })
}

const getHelpForCommandPath = (command: Command.Any, path: ReadonlyArray<string>): HelpDoc => {
  let current: Command.Any = command
  for (let i = 1; i < path.length; i++) {
    const sub = current.subcommands.find((s) => s.name === path[i])
    if (sub) current = sub
  }
  return toImpl(current).buildHelpDoc(path)
}

const checkForDuplicateFlags = (parent: Command.Any, subs: ReadonlyArray<Command.Any>): void => {
  const parentNames = new Set<string>()
  for (const f of toImpl(parent).config.flags)
    for (const s of extractSingleParams(f)) parentNames.add(s.name)
  for (const sub of subs)
    for (const f of toImpl(sub).config.flags)
      for (const s of extractSingleParams(f))
        if (parentNames.has(s.name))
          throw new CliError({ reason: "DuplicateOption", option: s.name, parentCommand: parent.name, childCommand: sub.name })
}

export const make: {
  <Name extends string>(name: Name, options?: {
    description?: string
    subcommands?: ReadonlyArray<Command<any, any, any, any>>
  }): Command<Name, {}, never, never>
  <Name extends string, const Cfg extends Command.Config>(name: Name, options: {
    config: Cfg; description?: string
    subcommands?: ReadonlyArray<Command<any, any, any, any>>
  }): Command<Name, Command.Config.Infer<Cfg>, never, never>
  <Name extends string, R, E>(name: Name, options: {
    description?: string
    subcommands?: ReadonlyArray<Command<any, any, any, any>>
    handler: (config: {}) => Effect.Effect<void, E, R>
  }): Command<Name, {}, E, R>
  <Name extends string, const Cfg extends Command.Config, R, E>(name: Name, options: {
    config: Cfg; description?: string
    subcommands?: ReadonlyArray<Command<any, any, any, any>>
    handler: (config: Command.Config.Infer<Cfg>) => Effect.Effect<void, E, R>
  }): Command<Name, Command.Config.Infer<Cfg>, E, R>
} = (<Name extends string>(name: Name, options?: {
  config?: Command.Config
  description?: string
  subcommands?: ReadonlyArray<Command<any, any, any, any>>
  handler?: (config: any) => Effect.Effect<void, any, any>
}) => {
  const parsed = parseConfig(options?.config ?? {})
  const cmd = makeCommandInternal({
    name, config: parsed,
    description: options?.description,
    ...(options?.handler ? { handle: options.handler } : {}),
  })
  if (!options?.subcommands?.length) return cmd

  const subs = options.subcommands
  checkForDuplicateFlags(cmd, subs)
  const impl = toImpl(cmd)
  const byName = new Map(subs.map((s) => [s.name, toImpl(s)] as const))

  const parse = (raw: ParsedTokens): Effect.Effect<any, CliError> =>
    Effect.gen(function*() {
      const parent = yield* impl.parse(raw)
      if (!raw.subcommand) return parent
      const sub = byName.get(raw.subcommand.name)
      if (!sub) return parent
      const result = yield* sub.parse(raw.subcommand.parsedInput)
      return Object.assign({}, parent, { _subcommand: { name: sub.name, result } })
    })

  const handle = (input: any, path: ReadonlyArray<string>): Effect.Effect<void, any, any> =>
    Effect.gen(function*() {
      if (input._subcommand) {
        const child = byName.get(input._subcommand.name)
        if (!child) return yield* Effect.fail(new CliError({ reason: "ShowHelp", commandPath: path }))
        return yield* child.handle(input._subcommand.result, [...path, child.name])
      }
      return yield* impl.handle(input, path)
    })

  return makeCommandInternal({
    name: impl.name, config: impl.config, description: impl.description as any,
    subcommands: subs, parse, handle,
  })
}) as any

const showHelp = (command: Command.Any, path: ReadonlyArray<string>, errors?: ReadonlyArray<CliError>) =>
  Effect.gen(function*() {
    yield* Console.log(formatHelpDoc(getHelpForCommandPath(command, path)))
    if (errors && errors.length > 0) yield* Console.error(formatErrors(errors))
  })

export const runWith = <N extends string, I, E, R>(
  command: Command<N, I, E, R>,
  config: { readonly version: string },
): (input: ReadonlyArray<string>) => Effect.Effect<void, E | CliError, R> => {
  const impl = toImpl(command)
  return (args: ReadonlyArray<string>) =>
    Effect.gen(function*() {
      const { tokens, trailingOperands } = lex(args)
      const { help, version, remainder } = yield* extractBuiltInOptions(tokens)
      const parsedArgs = yield* parseArgs({ tokens: remainder, trailingOperands }, command)
      const commandPath = [command.name, ...getCommandPath(parsedArgs)]

      if (help) { yield* Console.log(formatHelpDoc(getHelpForCommandPath(command, commandPath))); return }
      if (version) { yield* Console.log(formatVersion(command.name, config.version)); return }

      if (parsedArgs.errors && parsedArgs.errors.length > 0) {
        yield* showHelp(command, commandPath, parsedArgs.errors)
        return
      }

      const parseResult = yield* Effect.either(impl.parse(parsedArgs))
      if (parseResult._tag === "Left") {
        yield* showHelp(command, commandPath, [parseResult.left])
        return
      }

      yield* impl.handle(parseResult.right, [command.name]) as Effect.Effect<void, E | CliError, R>
    }) as Effect.Effect<void, E | CliError, R>
}

export const run: {
  <N extends string, I, E, R>(command: Command<N, I, E, R>, config: { readonly version: string }): Effect.Effect<void, E | CliError, R>
  (config: { readonly version: string }): <N extends string, I, E, R>(command: Command<N, I, E, R>) => Effect.Effect<void, E | CliError, R>
} = dual(2, <N extends string, I, E, R>(
  command: Command<N, I, E, R>, config: { readonly version: string },
) => runWith(command, config)(process.argv.slice(2)))
