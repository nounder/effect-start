import * as Function from "effect/Function"
import type * as Redacted from "effect/Redacted"
import * as Param from "./Param.ts"
import * as Primitive from "./Primitive.ts"

export interface Flag<A> extends Param.Param<"flag", A> {}

const flagMake = Param.makeConstructor("flag")

export const string = (name: string): Flag<string> => flagMake(name, Primitive.string)
export const boolean = (name: string): Flag<boolean> => flagMake(name, Primitive.boolean)
export const integer = (name: string): Flag<number> => flagMake(name, Primitive.integer)
export const float = (name: string): Flag<number> => flagMake(name, Primitive.float)
export const date = (name: string): Flag<Date> => flagMake(name, Primitive.date)
export const redacted = (name: string): Flag<Redacted.Redacted<string>> => flagMake(name, Primitive.redacted)
export const choice = <const C extends ReadonlyArray<string>>(name: string, choices: C): Flag<C[number]> =>
  Param.makeSingleParam({ kind: "flag", name, primitiveType: Primitive.choice(choices.map((v) => [v, v] as const)) })
export const choiceWithValue = <const C extends ReadonlyArray<readonly [string, any]>>(name: string, choices: C): Flag<C[number][1]> =>
  Param.makeSingleParam({ kind: "flag", name, primitiveType: Primitive.choice(choices) })
export const keyValuePair = (name: string): Flag<Record<string, string>> =>
  Param.paramMap(
    Param.paramVariadic(Param.makeSingleParam({ kind: "flag", name, primitiveType: Primitive.keyValuePair }), { min: 1 }),
    (objs) => Object.assign({}, ...objs),
  ) as Flag<Record<string, string>>
export const none: Flag<never> = Param.makeSingleParam({ kind: "flag", name: "__none__", primitiveType: Primitive.none }) as Flag<never>

export const withAlias: {
  (alias: string): <A>(self: Flag<A>) => Flag<A>
  <A>(self: Flag<A>, alias: string): Flag<A>
} = Function.dual(2, <A>(self: Flag<A>, alias: string): Flag<A> => Param.paramWithAlias(self, alias))

const combinators = Param.makeParamCombinators("flag")
export const optional = combinators.optional
export const withDefault = combinators.withDefault
export const withDescription = combinators.withDescription
export const withMetavar = combinators.withMetavar
export const map = combinators.map
export const mapEffect = combinators.mapEffect
export const variadic = combinators.variadic
export const filter = combinators.filter
export const withSchema = combinators.withSchema
export const orElse = combinators.orElse
