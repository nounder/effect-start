export const TypeId = Symbol.for("effect-start/HyperNode")
export type TypeId = typeof TypeId

const NoChildren: ReadonlyArray<never> = Object.freeze([])

type Primitive = string | number | boolean | null | undefined

export type Type = string | HyperComponent

export type Props = {
  [key: string]:
    | Primitive
    | HyperNode
    | Iterable<Primitive | HyperNode>
}

export type HyperComponent = (
  props: Props,
) => HyperNode | Primitive

export interface HyperNode {
  type: Type
  props: Props
}

export function make(
  type: Type,
  props: Props,
): HyperNode {
  return {
    type,
    props: {
      ...props,
      children: props.children ?? NoChildren,
    },
  }
}
