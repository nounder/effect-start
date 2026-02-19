import * as Console from "effect/Console"
import * as Effect from "effect/Effect"
import { dual } from "effect/Function"
import * as Option from "effect/Option"
import { type Pipeable, pipeArguments } from "effect/Pipeable"
import * as Predicate from "effect/Predicate"
import * as Redacted from "effect/Redacted"
import * as Schema from "effect/Schema"
import type { Simplify } from "effect/Types"

// Primitive

interface Primitive<out A> {
  readonly _tag: string
  readonly parse: (value: string) => Effect.Effect<A, string>
}

const makePrimitive = <A>(
  tag: string,
  parse: (value: string) => Effect.Effect<A, string>,
): Primitive<A> => ({ _tag: tag, parse })

const isTrueValue = (v: string) => ["true", "1", "y", "yes", "on"].includes(v.toLowerCase())
const isFalseValue = (v: string) => ["false", "0", "n", "no", "off"].includes(v.toLowerCase())
const isBooleanLiteral = (v: string) => isTrueValue(v) || isFalseValue(v)
const isPrimitiveBoolean = (p: Primitive<unknown>): p is Primitive<boolean> => p._tag === "Boolean"

const primitiveBoolean: Primitive<boolean> = makePrimitive("Boolean", (value) => {
  if (isTrueValue(value)) return Effect.succeed(true)
  if (isFalseValue(value)) return Effect.succeed(false)
  return Effect.fail(`Expected boolean (true/false/yes/no/on/off/1/0), got "${value}"`)
})

const primitiveString: Primitive<string> = makePrimitive("String", Effect.succeed)

const primitiveInteger: Primitive<number> = makePrimitive("Integer", (value) => {
  const n = Number(value)
  if (!Number.isInteger(n)) return Effect.fail(`Expected integer, got "${value}"`)
  return Effect.succeed(n)
})

const primitiveFloat: Primitive<number> = makePrimitive("Float", (value) => {
  const n = Number(value)
  if (!Number.isFinite(n)) return Effect.fail(`Expected number, got "${value}"`)
  return Effect.succeed(n)
})

const primitiveDate: Primitive<Date> = makePrimitive("Date", (value) => {
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return Effect.fail(`Expected valid date, got "${value}"`)
  return Effect.succeed(d)
})

const primitiveRedacted: Primitive<Redacted.Redacted<string>> = makePrimitive(
  "Redacted",
  (value) => Effect.succeed(Redacted.make(value)),
)

const primitiveKeyValuePair: Primitive<Record<string, string>> = makePrimitive(
  "KeyValuePair",
  (value) => {
    const idx = value.indexOf("=")
    if (idx <= 0 || idx === value.length - 1)
      return Effect.fail(`Expected key=value format, got "${value}"`)
    return Effect.succeed({ [value.slice(0, idx)]: value.slice(idx + 1) })
  },
)

const primitiveChoice = <A>(choices: ReadonlyArray<readonly [string, A]>): Primitive<A> => {
  const map = new Map(choices)
  const valid = choices.map(([k]) => k).join(" | ")
  return makePrimitive("Choice", (value) =>
    map.has(value)
      ? Effect.succeed(map.get(value)!)
      : Effect.fail(`Expected ${valid}, got "${value}"`))
}

const primitiveNone: Primitive<never> = makePrimitive("None", () =>
  Effect.fail("This option does not accept values"))

const getTypeName = <A>(p: Primitive<A>): string => {
  switch (p._tag) {
    case "Boolean": return "boolean"
    case "String": return "string"
    case "Integer": return "integer"
    case "Float": return "number"
    case "Date": return "date"
    case "Choice": return "choice"
    case "Redacted": return "string"
    case "KeyValuePair": return "key=value"
    case "None": return "none"
    default: return "value"
  }
}

// CliError

const CliErrorTypeId = "~effect-start/Cli/CliError"

export const isCliError = (u: unknown): u is CliError => Predicate.hasProperty(u, CliErrorTypeId)

export type CliError =
  | UnrecognizedOption | DuplicateOption | MissingOption | MissingArgument
  | InvalidValue | UnknownSubcommand | ShowHelp | UserError

const cliError = <Tag extends string, Props extends Record<string, any>>(
  tag: Tag, getMessage: (p: Props) => string,
) => class {
  readonly _tag = tag
  readonly [CliErrorTypeId] = CliErrorTypeId
  constructor(props: Props) { Object.assign(this, props) }
  get message() { return getMessage(this as any) }
}

const suggestText = (suggestions: ReadonlyArray<string>) =>
  suggestions.length > 0 ? `\n\n  Did you mean this?\n    ${suggestions.join("\n    ")}` : ""

export class UnrecognizedOption extends cliError<"UnrecognizedOption", {
  option: string; command?: ReadonlyArray<string>; suggestions: ReadonlyArray<string>
}>("UnrecognizedOption", (p) => {
  const base = p.command ? `Unrecognized flag: ${p.option} in command ${p.command.join(" ")}` : `Unrecognized flag: ${p.option}`
  return base + suggestText(p.suggestions)
}) {}

export class DuplicateOption extends cliError<"DuplicateOption", {
  option: string; parentCommand: string; childCommand: string
}>("DuplicateOption", (p) =>
  `Duplicate flag "${p.option}" in parent "${p.parentCommand}" and subcommand "${p.childCommand}".`) {}

export class MissingOption extends cliError<"MissingOption", { option: string }>(
  "MissingOption", (p) => `Missing required flag: --${p.option}`) {}

export class MissingArgument extends cliError<"MissingArgument", { argument: string }>(
  "MissingArgument", (p) => `Missing required argument: ${p.argument}`) {}

export class InvalidValue extends cliError<"InvalidValue", {
  option: string; value: string; expected: string; kind: "flag" | "argument"
}>("InvalidValue", (p) => p.kind === "argument"
  ? `Invalid value for argument <${p.option}>: "${p.value}". Expected: ${p.expected}`
  : `Invalid value for flag --${p.option}: "${p.value}". Expected: ${p.expected}`) {}

export class UnknownSubcommand extends cliError<"UnknownSubcommand", {
  subcommand: string; parent?: ReadonlyArray<string>; suggestions: ReadonlyArray<string>
}>("UnknownSubcommand", (p) => {
  const base = p.parent ? `Unknown subcommand "${p.subcommand}" for "${p.parent.join(" ")}"` : `Unknown subcommand "${p.subcommand}"`
  return base + suggestText(p.suggestions)
}) {}

export class ShowHelp extends cliError<"ShowHelp", { commandPath: ReadonlyArray<string> }>(
  "ShowHelp", () => "Help requested") {}

export class UserError extends cliError<"UserError", { cause: unknown }>(
  "UserError", (p) => String(p.cause)) {}

// HelpDoc

export interface HelpDoc {
  readonly description: string
  readonly usage: string
  readonly flags: ReadonlyArray<FlagDoc>
  readonly args?: ReadonlyArray<ArgDoc>
  readonly subcommands?: ReadonlyArray<SubcommandDoc>
}

export interface FlagDoc {
  readonly name: string
  readonly aliases: ReadonlyArray<string>
  readonly type: string
  readonly description: string | undefined
  readonly required: boolean
}

export interface SubcommandDoc {
  readonly name: string
  readonly description: string
}

export interface ArgDoc {
  readonly name: string
  readonly type: string
  readonly description: string | undefined
  readonly required: boolean
  readonly variadic: boolean
}

// Param (internal)

type ParamKind = "argument" | "flag"

interface Param<Kind extends ParamKind, out A> extends Pipeable {
  readonly _tag: string
  readonly kind: Kind
  readonly parse: ParamParse<A>
}

type ParamParse<A> = (args: ParsedArgs) => Effect.Effect<
  readonly [leftover: ReadonlyArray<string>, value: A],
  CliError
>

interface ParsedArgs {
  readonly flags: Record<string, ReadonlyArray<string>>
  readonly arguments: ReadonlyArray<string>
}

interface SingleParam<Kind extends ParamKind, out A> extends Param<Kind, A> {
  readonly _tag: "Single"
  readonly name: string
  readonly description: string | undefined
  readonly aliases: ReadonlyArray<string>
  readonly primitiveType: Primitive<A>
  readonly typeName?: string | undefined
}

const ParamProto = {
  pipe() { return pipeArguments(this, arguments) },
}

const isParam = (u: unknown): u is Param<any, any> =>
  typeof u === "object" && u !== null && "_tag" in u && "kind" in u && "parse" in u

const isFlagParam = <A>(s: SingleParam<ParamKind, A>): s is SingleParam<"flag", A> =>
  s.kind === "flag"

const makeSingleParam = <Kind extends ParamKind, A>(opts: {
  kind: Kind
  name: string
  primitiveType: Primitive<A>
  typeName?: string
  description?: string
  aliases?: ReadonlyArray<string>
}): SingleParam<Kind, A> => {
  const parse: ParamParse<A> = (args) =>
    opts.kind === "argument"
      ? parsePositional(opts.name, opts.primitiveType, args)
      : parseFlag(opts.name, opts.primitiveType, args)
  return Object.assign(Object.create(ParamProto), {
    _tag: "Single",
    ...opts,
    description: opts.description,
    aliases: opts.aliases ?? [],
    parse,
  })
}

const extractSingleParams = <K extends ParamKind>(p: Param<K, any>): Array<SingleParam<K, any>> => {
  if (p._tag === "Single") return [p as SingleParam<K, any>]
  if ("param" in p) return extractSingleParams((p as any).param)
  return []
}

const getUnderlyingSingle = <K extends ParamKind>(p: Param<K, any>): SingleParam<K, any> => {
  const singles = extractSingleParams(p)
  if (singles.length !== 1) throw new Error(`Expected exactly one Single param, got ${singles.length}`)
  return singles[0]
}

const getParamMetadata = (p: Param<any, any>): { isOptional: boolean; isVariadic: boolean } => {
  if (p._tag === "Optional") return { ...getParamMetadata((p as any).param), isOptional: true }
  if (p._tag === "Variadic") return { ...getParamMetadata((p as any).param), isVariadic: true }
  if ("param" in p) return getParamMetadata((p as any).param)
  return { isOptional: false, isVariadic: false }
}

const transformSingle = <K extends ParamKind, A>(
  p: Param<K, A>,
  f: <X>(s: SingleParam<K, X>) => SingleParam<K, X>,
): Param<K, A> => {
  if (p._tag === "Single") return f(p as SingleParam<K, any>) as Param<K, A>
  if (p._tag === "Map") {
    const m = p as any
    return paramMap(transformSingle(m.param, f), m.f)
  }
  if (p._tag === "Transform") {
    const t = p as any
    return paramTransform(transformSingle(t.param, f), t.f)
  }
  if (p._tag === "Optional") {
    const o = p as any
    return paramOptional(transformSingle(o.param, f)) as Param<K, A>
  }
  if (p._tag === "Variadic") {
    const v = p as any
    return paramVariadic(transformSingle(v.param, f), { min: v.min, max: v.max }) as Param<K, A>
  }
  return p
}

const parsePositional = <A>(
  name: string,
  prim: Primitive<A>,
  args: ParsedArgs,
): Effect.Effect<readonly [ReadonlyArray<string>, A], CliError> =>
  Effect.gen(function*() {
    if (args.arguments.length === 0) return yield* Effect.fail(new MissingArgument({ argument: name }))
    const value = yield* Effect.mapError(
      prim.parse(args.arguments[0]),
      (error) => new InvalidValue({ option: name, value: args.arguments[0], expected: error, kind: "argument" }),
    )
    return [args.arguments.slice(1), value] as const
  })

const parseFlag = <A>(
  name: string,
  prim: Primitive<A>,
  args: ParsedArgs,
): Effect.Effect<readonly [ReadonlyArray<string>, A], CliError> =>
  Effect.gen(function*() {
    const values = args.flags[name]
    if (!values || values.length === 0) {
      if (isPrimitiveBoolean(prim)) return [args.arguments, false as any] as const
      return yield* Effect.fail(new MissingOption({ option: name }))
    }
    const value = yield* Effect.mapError(
      prim.parse(values[0]),
      (error) => new InvalidValue({ option: name, value: values[0], expected: error, kind: "flag" }),
    )
    return [args.arguments, value] as const
  })

const paramMap = <K extends ParamKind, A, B>(self: Param<K, A>, f: (a: A) => B): Param<K, B> => {
  const parse: ParamParse<B> = (args) =>
    Effect.map(self.parse(args), ([l, v]) => [l, f(v)] as const)
  return Object.assign(Object.create(ParamProto), { _tag: "Map", kind: self.kind, param: self, f, parse })
}

const paramTransform = <K extends ParamKind, A, B>(
  self: Param<K, A>,
  f: (parse: ParamParse<A>) => ParamParse<B>,
): Param<K, B> =>
  Object.assign(Object.create(ParamProto), { _tag: "Transform", kind: self.kind, param: self, f, parse: f(self.parse) })

const paramMapEffect = <K extends ParamKind, A, B>(
  self: Param<K, A>,
  f: (a: A) => Effect.Effect<B, CliError>,
): Param<K, B> =>
  paramTransform(self, (parse) => (args) =>
    Effect.flatMap(parse(args), ([l, a]) => Effect.map(f(a), (b) => [l, b] as const)))

const paramOptional = <K extends ParamKind, A>(p: Param<K, A>): Param<K, Option.Option<A>> => {
  const parse: ParamParse<Option.Option<A>> = (args) =>
    p.parse(args).pipe(
      Effect.map(([l, v]) => [l, Option.some(v)] as const),
      Effect.catchTag("MissingOption", () => Effect.succeed([args.arguments, Option.none()] as const)),
      Effect.catchTag("MissingArgument", () => Effect.succeed([args.arguments, Option.none()] as const)),
    )
  return Object.assign(Object.create(ParamProto), { _tag: "Optional", kind: p.kind, param: p, parse })
}

const paramWithDefault = <K extends ParamKind, A, B>(self: Param<K, A>, defaultValue: B): Param<K, A | B> =>
  paramMap(paramOptional(self), Option.getOrElse(() => defaultValue))

const paramVariadic = <K extends ParamKind, A>(
  self: Param<K, A>,
  options?: { min?: number; max?: number },
): Param<K, ReadonlyArray<A>> => {
  const single = getUnderlyingSingle(self)
  const parse: ParamParse<ReadonlyArray<A>> = (args) => {
    if (single.kind === "argument") return parsePositionalVariadic(self, single, args, options)
    return parseOptionVariadic(self, single, args, options)
  }
  return Object.assign(Object.create(ParamProto), {
    _tag: "Variadic", kind: self.kind, param: self,
    min: options?.min, max: options?.max, parse,
  })
}

const parsePositionalVariadic = <K extends ParamKind, A>(
  self: Param<K, A>,
  single: SingleParam<K, A>,
  args: ParsedArgs,
  options?: { min?: number; max?: number },
): Effect.Effect<readonly [ReadonlyArray<string>, ReadonlyArray<A>], CliError> =>
  Effect.gen(function*() {
    const results: Array<A> = []
    const min = options?.min ?? 0
    const max = options?.max ?? Infinity
    let current = args.arguments
    while (current.length > 0 && results.length < max) {
      const [remaining, value] = yield* self.parse({ flags: args.flags, arguments: current })
      results.push(value)
      current = remaining
    }
    if (results.length < min) {
      return yield* Effect.fail(new InvalidValue({
        option: single.name, value: `${results.length} values`,
        expected: `at least ${min} value${min === 1 ? "" : "s"}`, kind: single.kind,
      }))
    }
    return [current, results] as const
  })

const parseOptionVariadic = <K extends ParamKind, A>(
  self: Param<K, A>,
  single: SingleParam<K, A>,
  args: ParsedArgs,
  options?: { min?: number; max?: number },
): Effect.Effect<readonly [ReadonlyArray<string>, ReadonlyArray<A>], CliError> =>
  Effect.gen(function*() {
    const names = [single.name, ...single.aliases]
    const values = names.flatMap((n) => args.flags[n] ?? [])
    const count = values.length
    if (options?.min !== undefined && count < options.min) {
      return yield* count === 0
        ? Effect.fail(new MissingOption({ option: single.name }))
        : Effect.fail(new InvalidValue({
          option: single.name, value: `${count} occurrences`,
          expected: `at least ${options.min} value${options.min === 1 ? "" : "s"}`, kind: single.kind,
        }))
    }
    if (options?.max !== undefined && count > options.max) {
      return yield* Effect.fail(new InvalidValue({
        option: single.name, value: `${count} occurrences`,
        expected: `at most ${options.max} value${options.max === 1 ? "" : "s"}`, kind: single.kind,
      }))
    }
    const results: Array<A> = []
    for (const v of values) {
      const [, parsed] = yield* self.parse({ flags: { [single.name]: [v] }, arguments: [] })
      results.push(parsed)
    }
    return [args.arguments, results] as const
  })

const DASH_RE = /^-+/

const paramWithAlias = <K extends ParamKind, A>(self: Param<K, A>, alias: string): Param<K, A> =>
  transformSingle(self, (s) => makeSingleParam({ ...s, aliases: [...s.aliases, alias.replace(DASH_RE, "")] }))

const paramWithDescription = <K extends ParamKind, A>(self: Param<K, A>, desc: string): Param<K, A> =>
  transformSingle(self, (s) => makeSingleParam({ ...s, description: desc }))

const paramWithMetavar = <K extends ParamKind, A>(self: Param<K, A>, metavar: string): Param<K, A> =>
  transformSingle(self, (s) => makeSingleParam({ ...s, typeName: metavar }))

// Shared combinators

const makeParamCombinators = <K extends ParamKind>(kind: K) => ({
  optional: <A>(self: Param<K, A>): Param<K, Option.Option<A>> => paramOptional(self),
  withDefault: dual(2, <A, B>(self: Param<K, A>, value: B): Param<K, A | B> => paramWithDefault(self, value)),
  withDescription: dual(2, <A>(self: Param<K, A>, desc: string): Param<K, A> => paramWithDescription(self, desc)),
  withMetavar: dual(2, <A>(self: Param<K, A>, metavar: string): Param<K, A> => paramWithMetavar(self, metavar)),
  map: dual(2, <A, B>(self: Param<K, A>, f: (a: A) => B): Param<K, B> => paramMap(self, f)),
  mapEffect: dual(2, <A, B>(self: Param<K, A>, f: (a: A) => Effect.Effect<B, CliError>): Param<K, B> =>
    paramMapEffect(self, f)),
  variadic: dual(2, <A>(self: Param<K, A>, options?: { min?: number; max?: number }): Param<K, ReadonlyArray<A>> =>
    paramVariadic(self, options)),
  atLeast: dual(2, <A>(self: Param<K, A>, min: number): Param<K, ReadonlyArray<A>> => paramVariadic(self, { min })),
  atMost: dual(2, <A>(self: Param<K, A>, max: number): Param<K, ReadonlyArray<A>> => paramVariadic(self, { max })),
  between: dual(3, <A>(self: Param<K, A>, min: number, max: number): Param<K, ReadonlyArray<A>> =>
    paramVariadic(self, { min, max })),
  filter: dual(3, <A>(self: Param<K, A>, pred: (a: A) => boolean, onFalse: (a: A) => string): Param<K, A> =>
    paramMapEffect(self, (a) => {
      if (pred(a)) return Effect.succeed(a)
      const s = getUnderlyingSingle(self)
      return Effect.fail(new InvalidValue({ option: s.name, value: String(a), expected: onFalse(a), kind: s.kind }))
    })),
  withSchema: dual(2, <A, B>(self: Param<K, A>, schema: Schema.Schema<B, A>): Param<K, B> => {
    const decode = Schema.decodeUnknown(schema)
    return paramMapEffect(self, (v) =>
      Effect.mapError(decode(v), (err) => {
        const s = getUnderlyingSingle(self)
        return new InvalidValue({ option: s.name, value: String(v), expected: `Schema validation failed: ${err.message}`, kind: s.kind })
      }))
  }),
  orElse: dual(2, <A, B>(self: Param<K, A>, that: () => Param<K, B>): Param<K, A | B> =>
    paramTransform<K, A, A | B>(self, (parse) => (args) => Effect.catchAll(parse(args), () => that().parse(args)))),
})

const makeConstructor = <K extends ParamKind>(kind: K) => (name: string, prim: Primitive<any>) =>
  makeSingleParam({ kind, name, primitiveType: prim })

// Argument

export interface Argument<A> extends Param<"argument", A> {}

const argMake = makeConstructor("argument")
export const Argument = {
  string: (name: string): Argument<string> => argMake(name, primitiveString),
  integer: (name: string): Argument<number> => argMake(name, primitiveInteger),
  float: (name: string): Argument<number> => argMake(name, primitiveFloat),
  date: (name: string): Argument<Date> => argMake(name, primitiveDate),
  redacted: (name: string): Argument<Redacted.Redacted<string>> => argMake(name, primitiveRedacted),
  choice: <const C extends ReadonlyArray<string>>(name: string, choices: C): Argument<C[number]> =>
    makeSingleParam({ kind: "argument", name, primitiveType: primitiveChoice(choices.map((v) => [v, v] as const)) }),
  choiceWithValue: <const C extends ReadonlyArray<readonly [string, any]>>(name: string, choices: C): Argument<C[number][1]> =>
    makeSingleParam({ kind: "argument", name, primitiveType: primitiveChoice(choices) }),
  none: makeSingleParam({ kind: "argument", name: "__none__", primitiveType: primitiveNone }) as Argument<never>,
  ...makeParamCombinators("argument"),
}

// Flag

export interface Flag<A> extends Param<"flag", A> {}

const flagMake = makeConstructor("flag")
export const Flag = {
  string: (name: string): Flag<string> => flagMake(name, primitiveString),
  boolean: (name: string): Flag<boolean> => flagMake(name, primitiveBoolean),
  integer: (name: string): Flag<number> => flagMake(name, primitiveInteger),
  float: (name: string): Flag<number> => flagMake(name, primitiveFloat),
  date: (name: string): Flag<Date> => flagMake(name, primitiveDate),
  redacted: (name: string): Flag<Redacted.Redacted<string>> => flagMake(name, primitiveRedacted),
  choice: <const C extends ReadonlyArray<string>>(name: string, choices: C): Flag<C[number]> =>
    makeSingleParam({ kind: "flag", name, primitiveType: primitiveChoice(choices.map((v) => [v, v] as const)) }),
  choiceWithValue: <const C extends ReadonlyArray<readonly [string, any]>>(name: string, choices: C): Flag<C[number][1]> =>
    makeSingleParam({ kind: "flag", name, primitiveType: primitiveChoice(choices) }),
  keyValuePair: (name: string): Flag<Record<string, string>> =>
    paramMap(
      paramVariadic(makeSingleParam({ kind: "flag", name, primitiveType: primitiveKeyValuePair }), { min: 1 }),
      (objs) => Object.assign({}, ...objs),
    ) as Flag<Record<string, string>>,
  none: makeSingleParam({ kind: "flag", name: "__none__", primitiveType: primitiveNone }) as Flag<never>,
  withAlias: dual(2, <A>(self: Flag<A>, alias: string): Flag<A> => paramWithAlias(self, alias)),
  ...makeParamCombinators("flag"),
}

// Lexer

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

// Auto-suggest

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

// Config (internal)

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

// Built-in flags

const helpFlag: Flag<boolean> = Flag.boolean("help").pipe(Flag.withAlias("h"), Flag.withDescription("Show help information"))
const versionFlag: Flag<boolean> = Flag.boolean("version").pipe(Flag.withDescription("Show version information"))
const logLevelFlag: Flag<Option.Option<string>> = Flag.choice("log-level", [
  "all", "trace", "debug", "info", "warn", "warning", "error", "fatal", "none",
] as const).pipe(Flag.optional, Flag.withDescription("Sets the minimum log level"))

// Parser

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
  if (isPrimitiveBoolean(spec.primitiveType)) {
    const next = tokens[i + 1]
    if (next?._tag === "Value" && isBooleanLiteral(next.value)) return { value: next.value, skip: 1 }
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
          errors.push(new UnrecognizedOption({ option: t._tag === "LongOption" ? `--${t.name}` : `-${t.flag}`, suggestions: sug, command: newPath }))
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
            errors.push(new UnknownSubcommand({ subcommand: t.value, parent: newPath, suggestions: sug }))
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

// CliOutput

const formatHelpDoc = (doc: HelpDoc): string => {
  const sections: Array<string> = []
  if (doc.description) { sections.push("DESCRIPTION"); sections.push(`  ${doc.description}`); sections.push("") }
  sections.push("USAGE"); sections.push(`  ${doc.usage}`); sections.push("")
  if (doc.args && doc.args.length > 0) {
    sections.push("ARGUMENTS")
    for (const a of doc.args) {
      let n = a.name + (a.variadic ? "..." : "")
      const opt = a.required ? "" : " (optional)"
      sections.push(`  ${n} ${a.type}    ${(a.description ?? "") + opt}`)
    }
    sections.push("")
  }
  if (doc.flags.length > 0) {
    sections.push("FLAGS")
    for (const f of doc.flags) {
      const names = [`--${f.name}`, ...f.aliases].join(", ")
      const tp = f.type !== "boolean" ? ` ${f.type}` : ""
      sections.push(`  ${names}${tp}    ${f.description ?? ""}`)
    }
    sections.push("")
  }
  if (doc.subcommands && doc.subcommands.length > 0) {
    sections.push("SUBCOMMANDS")
    for (const s of doc.subcommands) sections.push(`  ${s.name}    ${s.description}`)
    sections.push("")
  }
  if (sections[sections.length - 1] === "") sections.pop()
  return sections.join("\n")
}

const formatVersion = (name: string, version: string): string => `${name} v${version}`

const formatErrors = (errors: ReadonlyArray<CliError>): string => {
  if (errors.length === 0) return ""
  if (errors.length === 1) return `\nERROR\n  ${errors[0].message}`
  return `\nERRORS\n` + errors.map((e) => `  ${e.message}`).join("\n")
}

// Command

const CommandTypeId = "~effect-start/Cli/Command" as const

export interface Command<Name extends string, Input, E = never, R = never> extends Pipeable {
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

const CommandProto = {
  pipe() { return pipeArguments(this, arguments) },
}

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
    opts.handle ? opts.handle(input, path) : Effect.fail(new ShowHelp({ commandPath: path })) as any

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
          name: s.name, type: s.typeName ?? getTypeName(s.primitiveType),
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
          type: s.typeName ?? getTypeName(s.primitiveType),
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

  return Object.assign(Object.create(CommandProto), {
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
          throw new DuplicateOption({ option: s.name, parentCommand: parent.name, childCommand: sub.name })
}

// Command public API

export const make: {
  <Name extends string>(name: Name): Command<Name, {}, never, never>
  <Name extends string, const Cfg extends Command.Config>(name: Name, config: Cfg): Command<Name, Command.Config.Infer<Cfg>, never, never>
  <Name extends string, const Cfg extends Command.Config, R, E>(
    name: Name, config: Cfg, handler: (config: Command.Config.Infer<Cfg>) => Effect.Effect<void, E, R>,
  ): Command<Name, Command.Config.Infer<Cfg>, E, R>
} = ((name: string, config?: Command.Config, handler?: any) => {
  const parsed = parseConfig(config ?? {})
  return makeCommandInternal({ name, config: parsed, ...(handler ? { handle: handler } : {}) })
}) as any

export const withHandler: {
  <A, R, E>(handler: (value: A) => Effect.Effect<void, E, R>): <N extends string, XR, XE>(self: Command<N, A, XE, XR>) => Command<N, A, E, R>
  <N extends string, A, XR, XE, R, E>(self: Command<N, A, XE, XR>, handler: (value: A) => Effect.Effect<void, E, R>): Command<N, A, E, R>
} = dual(2, <N extends string, A, XR, XE, R, E>(
  self: Command<N, A, XE, XR>, handler: (value: A) => Effect.Effect<void, E, R>,
): Command<N, A, E, R> => makeCommandInternal({ ...toImpl(self), handle: handler }))

export const withSubcommands: {
  <const Subs extends ReadonlyArray<Command<any, any, any, any>>>(subs: Subs): <N extends string, I, E, R>(
    self: Command<N, I, E, R>,
  ) => Command<N, I, any, any>
  <N extends string, I, E, R, const Subs extends ReadonlyArray<Command<any, any, any, any>>>(
    self: Command<N, I, E, R>, subs: Subs,
  ): Command<N, I, any, any>
} = dual(2, <N extends string, I, E, R>(
  self: Command<N, I, E, R>, subs: ReadonlyArray<Command<any, any, any, any>>,
) => {
  checkForDuplicateFlags(self, subs)
  const impl = toImpl(self)
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
        if (!child) return yield* Effect.fail(new ShowHelp({ commandPath: path }))
        return yield* child.handle(input._subcommand.result, [...path, child.name])
      }
      return yield* impl.handle(input, path)
    })

  return makeCommandInternal({
    name: impl.name, config: impl.config, description: impl.description as any,
    subcommands: subs, parse, handle,
  })
})

export const withDescription: {
  (desc: string): <N extends string, I, E, R>(self: Command<N, I, E, R>) => Command<N, I, E, R>
  <N extends string, I, E, R>(self: Command<N, I, E, R>, desc: string): Command<N, I, E, R>
} = dual(2, <N extends string, I, E, R>(self: Command<N, I, E, R>, desc: string) =>
  makeCommandInternal({ ...toImpl(self), description: desc }))

// Execution

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
