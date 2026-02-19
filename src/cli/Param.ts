import * as Effect from "effect/Effect"
import * as Function from "effect/Function"
import * as Option from "effect/Option"
import * as Pipeable from "effect/Pipeable"
import * as Schema from "effect/Schema"
import * as CliError from "./CliError.ts"
import * as Primitive from "./Primitive.ts"

export type ParamKind = "argument" | "flag"

export interface Param<Kind extends ParamKind, out A> extends Pipeable.Pipeable {
  readonly _tag: string
  readonly kind: Kind
  readonly parse: ParamParse<A>
}

export type ParamParse<A> = (
  args: ParsedArgs,
) => Effect.Effect<readonly [leftover: ReadonlyArray<string>, value: A], CliError.CliError>

export interface ParsedArgs {
  readonly flags: Record<string, ReadonlyArray<string>>
  readonly arguments: ReadonlyArray<string>
}

export interface SingleParam<Kind extends ParamKind, out A> extends Param<Kind, A> {
  readonly _tag: "Single"
  readonly name: string
  readonly description: string | undefined
  readonly aliases: ReadonlyArray<string>
  readonly primitiveType: Primitive.Primitive<A>
  readonly typeName?: string | undefined
}

const ParamProto = {
  pipe() {
    return Pipeable.pipeArguments(this, arguments)
  },
}

export const isParam = (u: unknown): u is Param<any, any> =>
  typeof u === "object" && u !== null && "_tag" in u && "kind" in u && "parse" in u

export const isFlagParam = <A>(s: SingleParam<ParamKind, A>): s is SingleParam<"flag", A> =>
  s.kind === "flag"

export const makeSingleParam = <Kind extends ParamKind, A>(opts: {
  kind: Kind
  name: string
  primitiveType: Primitive.Primitive<A>
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

export const extractSingleParams = <K extends ParamKind>(
  p: Param<K, any>,
): Array<SingleParam<K, any>> => {
  if (p._tag === "Single") return [p as SingleParam<K, any>]
  if ("param" in p) return extractSingleParams((p as any).param)
  return []
}

export const getUnderlyingSingle = <K extends ParamKind>(p: Param<K, any>): SingleParam<K, any> => {
  const singles = extractSingleParams(p)
  if (singles.length !== 1)
    throw new Error(`Expected exactly one Single param, got ${singles.length}`)
  return singles[0]
}

export const getParamMetadata = (
  p: Param<any, any>,
): { isOptional: boolean; isVariadic: boolean } => {
  if (p._tag === "Optional") return { ...getParamMetadata((p as any).param), isOptional: true }
  if (p._tag === "Variadic") return { ...getParamMetadata((p as any).param), isVariadic: true }
  if ("param" in p) return getParamMetadata((p as any).param)
  return { isOptional: false, isVariadic: false }
}

export const transformSingle = <K extends ParamKind, A>(
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
  prim: Primitive.Primitive<A>,
  args: ParsedArgs,
): Effect.Effect<readonly [ReadonlyArray<string>, A], CliError.CliError> =>
  Effect.gen(function* () {
    if (args.arguments.length === 0)
      return yield* Effect.fail(
        new CliError.CliError({ reason: "MissingArgument", argument: name }),
      )
    const value = yield* Effect.mapError(
      prim.parse(args.arguments[0]),
      (error) =>
        new CliError.CliError({
          reason: "InvalidValue",
          option: name,
          value: args.arguments[0],
          expected: error,
          kind: "argument",
        }),
    )
    return [args.arguments.slice(1), value] as const
  })

const parseFlag = <A>(
  name: string,
  prim: Primitive.Primitive<A>,
  args: ParsedArgs,
): Effect.Effect<readonly [ReadonlyArray<string>, A], CliError.CliError> =>
  Effect.gen(function* () {
    const values = args.flags[name]
    if (!values || values.length === 0) {
      if (Primitive.isBoolean(prim)) return [args.arguments, false as any] as const
      return yield* Effect.fail(new CliError.CliError({ reason: "MissingOption", option: name }))
    }
    const value = yield* Effect.mapError(
      prim.parse(values[0]),
      (error) =>
        new CliError.CliError({
          reason: "InvalidValue",
          option: name,
          value: values[0],
          expected: error,
          kind: "flag",
        }),
    )
    return [args.arguments, value] as const
  })

export const paramMap = <K extends ParamKind, A, B>(
  self: Param<K, A>,
  f: (a: A) => B,
): Param<K, B> => {
  const parse: ParamParse<B> = (args) =>
    Effect.map(self.parse(args), ([l, v]) => [l, f(v)] as const)
  return Object.assign(Object.create(ParamProto), {
    _tag: "Map",
    kind: self.kind,
    param: self,
    f,
    parse,
  })
}

export const paramTransform = <K extends ParamKind, A, B>(
  self: Param<K, A>,
  f: (parse: ParamParse<A>) => ParamParse<B>,
): Param<K, B> =>
  Object.assign(Object.create(ParamProto), {
    _tag: "Transform",
    kind: self.kind,
    param: self,
    f,
    parse: f(self.parse),
  })

export const paramMapEffect = <K extends ParamKind, A, B>(
  self: Param<K, A>,
  f: (a: A) => Effect.Effect<B, CliError.CliError>,
): Param<K, B> =>
  paramTransform(
    self,
    (parse) => (args) =>
      Effect.flatMap(parse(args), ([l, a]) => Effect.map(f(a), (b) => [l, b] as const)),
  )

export const paramOptional = <K extends ParamKind, A>(
  p: Param<K, A>,
): Param<K, Option.Option<A>> => {
  const parse: ParamParse<Option.Option<A>> = (args) =>
    p.parse(args).pipe(
      Effect.map(([l, v]) => [l, Option.some(v)] as const),
      Effect.catchAll((e) =>
        e.reason === "MissingOption" || e.reason === "MissingArgument"
          ? Effect.succeed([args.arguments, Option.none()] as const)
          : Effect.fail(e),
      ),
    )
  return Object.assign(Object.create(ParamProto), {
    _tag: "Optional",
    kind: p.kind,
    param: p,
    parse,
  })
}

export const paramWithDefault = <K extends ParamKind, A, B>(
  self: Param<K, A>,
  defaultValue: B,
): Param<K, A | B> =>
  paramMap(
    paramOptional(self),
    Option.getOrElse(() => defaultValue),
  )

export const paramVariadic = <K extends ParamKind, A>(
  self: Param<K, A>,
  options?: { min?: number; max?: number },
): Param<K, ReadonlyArray<A>> => {
  const single = getUnderlyingSingle(self)
  const parse: ParamParse<ReadonlyArray<A>> = (args) => {
    if (single.kind === "argument") return parsePositionalVariadic(self, single, args, options)
    return parseOptionVariadic(self, single, args, options)
  }
  return Object.assign(Object.create(ParamProto), {
    _tag: "Variadic",
    kind: self.kind,
    param: self,
    min: options?.min,
    max: options?.max,
    parse,
  })
}

const parsePositionalVariadic = <K extends ParamKind, A>(
  self: Param<K, A>,
  single: SingleParam<K, A>,
  args: ParsedArgs,
  options?: { min?: number; max?: number },
): Effect.Effect<readonly [ReadonlyArray<string>, ReadonlyArray<A>], CliError.CliError> =>
  Effect.gen(function* () {
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
      return yield* Effect.fail(
        new CliError.CliError({
          reason: "InvalidValue",
          option: single.name,
          value: `${results.length} values`,
          expected: `at least ${min} value${min === 1 ? "" : "s"}`,
          kind: single.kind,
        }),
      )
    }
    return [current, results] as const
  })

const parseOptionVariadic = <K extends ParamKind, A>(
  self: Param<K, A>,
  single: SingleParam<K, A>,
  args: ParsedArgs,
  options?: { min?: number; max?: number },
): Effect.Effect<readonly [ReadonlyArray<string>, ReadonlyArray<A>], CliError.CliError> =>
  Effect.gen(function* () {
    const names = [single.name, ...single.aliases]
    const values = names.flatMap((n) => args.flags[n] ?? [])
    const count = values.length
    if (options?.min !== undefined && count < options.min) {
      return yield* count === 0
        ? Effect.fail(new CliError.CliError({ reason: "MissingOption", option: single.name }))
        : Effect.fail(
            new CliError.CliError({
              reason: "InvalidValue",
              option: single.name,
              value: `${count} occurrences`,
              expected: `at least ${options.min} value${options.min === 1 ? "" : "s"}`,
              kind: single.kind,
            }),
          )
    }
    if (options?.max !== undefined && count > options.max) {
      return yield* Effect.fail(
        new CliError.CliError({
          reason: "InvalidValue",
          option: single.name,
          value: `${count} occurrences`,
          expected: `at most ${options.max} value${options.max === 1 ? "" : "s"}`,
          kind: single.kind,
        }),
      )
    }
    const results: Array<A> = []
    for (const v of values) {
      const [, parsed] = yield* self.parse({ flags: { [single.name]: [v] }, arguments: [] })
      results.push(parsed)
    }
    return [args.arguments, results] as const
  })

const DASH_RE = /^-+/

export const paramWithAlias = <K extends ParamKind, A>(
  self: Param<K, A>,
  alias: string,
): Param<K, A> =>
  transformSingle(self, (s) =>
    makeSingleParam({ ...s, aliases: [...s.aliases, alias.replace(DASH_RE, "")] }),
  )

export const paramWithDescription = <K extends ParamKind, A>(
  self: Param<K, A>,
  desc: string,
): Param<K, A> => transformSingle(self, (s) => makeSingleParam({ ...s, description: desc }))

export const paramWithMetavar = <K extends ParamKind, A>(
  self: Param<K, A>,
  metavar: string,
): Param<K, A> => transformSingle(self, (s) => makeSingleParam({ ...s, typeName: metavar }))

export const makeParamCombinators = <K extends ParamKind>(_kind: K) => ({
  optional: <A>(self: Param<K, A>): Param<K, Option.Option<A>> => paramOptional(self),
  withDefault: Function.dual(
    2,
    <A, B>(self: Param<K, A>, value: B): Param<K, A | B> => paramWithDefault(self, value),
  ),
  withDescription: Function.dual(
    2,
    <A>(self: Param<K, A>, desc: string): Param<K, A> => paramWithDescription(self, desc),
  ),
  withMetavar: Function.dual(
    2,
    <A>(self: Param<K, A>, metavar: string): Param<K, A> => paramWithMetavar(self, metavar),
  ),
  map: Function.dual(
    2,
    <A, B>(self: Param<K, A>, f: (a: A) => B): Param<K, B> => paramMap(self, f),
  ),
  mapEffect: Function.dual(
    2,
    <A, B>(self: Param<K, A>, f: (a: A) => Effect.Effect<B, CliError.CliError>): Param<K, B> =>
      paramMapEffect(self, f),
  ),
  variadic: Function.dual(
    2,
    <A>(self: Param<K, A>, options?: { min?: number; max?: number }): Param<K, ReadonlyArray<A>> =>
      paramVariadic(self, options),
  ),
  filter: Function.dual(
    3,
    <A>(self: Param<K, A>, pred: (a: A) => boolean, onFalse: (a: A) => string): Param<K, A> =>
      paramMapEffect(self, (a) => {
        if (pred(a)) return Effect.succeed(a)
        const s = getUnderlyingSingle(self)
        return Effect.fail(
          new CliError.CliError({
            reason: "InvalidValue",
            option: s.name,
            value: String(a),
            expected: onFalse(a),
            kind: s.kind,
          }),
        )
      }),
  ),
  withSchema: Function.dual(
    2,
    <A, B>(self: Param<K, A>, schema: Schema.Schema<B, A>): Param<K, B> => {
      const decode = Schema.decodeUnknown(schema)
      return paramMapEffect(self, (v) =>
        Effect.mapError(decode(v), (err) => {
          const s = getUnderlyingSingle(self)
          return new CliError.CliError({
            reason: "InvalidValue",
            option: s.name,
            value: String(v),
            expected: `Schema validation failed: ${err.message}`,
            kind: s.kind,
          })
        }),
      )
    },
  ),
  orElse: Function.dual(
    2,
    <A, B>(self: Param<K, A>, that: () => Param<K, B>): Param<K, A | B> =>
      paramTransform<K, A, A | B>(
        self,
        (parse) => (args) => Effect.catchAll(parse(args), () => that().parse(args)),
      ),
  ),
})

export const makeConstructor =
  <K extends ParamKind>(kind: K) =>
  (name: string, prim: Primitive.Primitive<any>) =>
    makeSingleParam({ kind, name, primitiveType: prim })
