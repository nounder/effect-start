import * as Context from "effect/Context"
import * as Fiber from "effect/Fiber"
import * as Option from "effect/Option"
import type { JSX } from "./jsx.d.ts"

type Elements = JSX.IntrinsicElements

type Children = JSX.Children

export type { Children, Elements, JSX }

export class Hyper extends Context.Tag("Hyper")<
  Hyper,
  {}
>() {}

const NoChildren: ReadonlyArray<never> = Object.freeze([])

type Primitive = string | number | boolean | null | undefined

export type HyperType = string | HyperComponent

export type HyperProps = {
  [key: string]: Primitive | ReadonlyArray<Primitive> | HyperNode | HyperNode[] | null | undefined
}

export type HyperComponent = (props: HyperProps) => HyperNode | Primitive

export interface HyperNode {
  type: HyperType
  props: HyperProps
}

export function h(type: HyperType, props: HyperProps): HyperNode {
  return {
    type,
    props: {
      ...props,
      children: props.children ?? NoChildren,
    },
  }
}

export function unsafeUse<Value>(tag: Context.Tag<any, Value>) {
  const currentFiber = Option.getOrThrow(Fiber.getCurrentFiber())
  const context = currentFiber.currentContext

  return Context.unsafeGet(context, tag)
}

export type GenericJsxObject = {
  type: any
  props: any
}

export function isGenericJsxObject(value: unknown): value is GenericJsxObject {
  return typeof value === "object" && value !== null && "type" in value && "props" in value
}
