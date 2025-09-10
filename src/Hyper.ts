import { HttpServerResponse } from "@effect/platform"
import * as HttpApp from "@effect/platform/HttpApp"
import {
  Effect,
  Fiber,
} from "effect"
import * as Context from "effect/Context"
import * as Layer from "effect/Layer"
import * as Option from "effect/Option"
import { YieldWrap } from "effect/Utils"
import { HyperHooks } from "./Datastar.ts"
import * as HyperHtml from "./HyperHtml.ts"
import type { JSX } from "./jsx.d.ts"

type Elements = JSX.IntrinsicElements

type Children = JSX.Children

export type {
  Children,
  Elements,
  JSX,
}

export class Hyper extends Context.Tag("Hyper")<Hyper, {
  hooks: typeof HyperHooks | undefined
}>() {}

export function layer(opts: {
  hooks: typeof HyperHooks
}) {
  return Layer.sync(Hyper, () => {
    return {
      hooks: opts.hooks,
    }
  })
}

/**
 * Accepts Effect that returns a HyperNode
 * to a HttpApp.
 */
export function handle<E, R>(
  handler: Effect.Effect<
    JSX.Children | HttpServerResponse.HttpServerResponse,
    E,
    R
  >,
): HttpApp.Default<E, R>
export function handle(
  handler: () => Generator<
    never,
    JSX.Children | HttpServerResponse.HttpServerResponse,
    any
  >,
): HttpApp.Default<never, never>
export function handle<Eff extends YieldWrap<Effect.Effect<any, any, any>>>(
  handler: () => Generator<
    Eff,
    JSX.Children | HttpServerResponse.HttpServerResponse,
    any
  >,
): HttpApp.Default<
  [Eff] extends [YieldWrap<Effect.Effect<infer _A, infer E, infer _R>>] ? E
    : never,
  [Eff] extends [YieldWrap<Effect.Effect<infer _A, infer _E, infer R>>] ? R
    : never
>
export function handle(
  handler:
    | Effect.Effect<
      JSX.Children | HttpServerResponse.HttpServerResponse,
      any,
      any
    >
    | (() => Generator<
      YieldWrap<Effect.Effect<any, any, any>>,
      JSX.Children | HttpServerResponse.HttpServerResponse,
      any
    >),
): HttpApp.Default<any, any> {
  return Effect.gen(function*() {
    const hyper = yield* Effect.serviceOption(Hyper).pipe(
      Effect.andThen(Option.getOrNull),
    )
    const effect = isGenerator(handler) ? Effect.gen(handler) : handler
    const value = yield* effect

    if (HttpServerResponse.isServerResponse(value)) {
      return value
    }

    const html = HyperHtml.renderToString(value, hyper?.hooks)

    return yield* HttpServerResponse.html`${html}`
  })
}

function isGenerator<A, E, R>(
  handler: any,
): handler is () => Generator<YieldWrap<Effect.Effect<A, E, R>>, any, any> {
  return typeof handler === "function"
    && handler.constructor?.name === "GeneratorFunction"
}

const NoChildren: ReadonlyArray<never> = Object.freeze([])

type Primitive = string | number | boolean | null | undefined

export type HyperType = string | HyperComponent

export type HyperProps = {
  [key: string]:
    | Primitive
    | ReadonlyArray<Primitive>
    | HyperNode
    | HyperNode[]
    | null
    | undefined
}

export type HyperComponent = (
  props: HyperProps,
) => HyperNode | Primitive

export interface HyperNode {
  type: HyperType
  props: HyperProps
}

export function h(
  type: HyperType,
  props: HyperProps,
): HyperNode {
  return {
    type,
    props: {
      ...props,
      children: props.children ?? NoChildren,
    },
  }
}

export function unsafeUse<Value>(tag: Context.Tag<any, Value>) {
  const currentFiber = Option.getOrThrow(
    Fiber.getCurrentFiber(),
  )
  const context = currentFiber.currentContext

  return Context.unsafeGet(context, tag)
}
