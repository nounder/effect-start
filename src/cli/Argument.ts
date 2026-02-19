import * as Redacted from "effect/Redacted"
import type { Param } from "./Param.ts"
import { makeConstructor, makeParamCombinators, makeSingleParam } from "./Param.ts"
import * as Primitive from "./Primitive.ts"

export interface Argument<A> extends Param<"argument", A> {}

const argMake = makeConstructor("argument")

export const string = (name: string): Argument<string> => argMake(name, Primitive.string)
export const integer = (name: string): Argument<number> => argMake(name, Primitive.integer)
export const float = (name: string): Argument<number> => argMake(name, Primitive.float)
export const date = (name: string): Argument<Date> => argMake(name, Primitive.date)
export const redacted = (name: string): Argument<Redacted.Redacted<string>> => argMake(name, Primitive.redacted)
export const choice = <const C extends ReadonlyArray<string>>(name: string, choices: C): Argument<C[number]> =>
  makeSingleParam({ kind: "argument", name, primitiveType: Primitive.choice(choices.map((v) => [v, v] as const)) })
export const choiceWithValue = <const C extends ReadonlyArray<readonly [string, any]>>(name: string, choices: C): Argument<C[number][1]> =>
  makeSingleParam({ kind: "argument", name, primitiveType: Primitive.choice(choices) })
export const none: Argument<never> = makeSingleParam({ kind: "argument", name: "__none__", primitiveType: Primitive.none }) as Argument<never>

const combinators = makeParamCombinators("argument")
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
