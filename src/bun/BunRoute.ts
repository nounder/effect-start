export const TypeId = Symbol.for("effect-start/BunRoute")
export type TypeId = typeof TypeId

export interface BunRoute {
  readonly [TypeId]: TypeId
  readonly _tag: "BunRoute"
  readonly load: () => Promise<any>
}

export const load = (loader: () => Promise<any>): BunRoute => {
  return {
    [TypeId]: TypeId,
    _tag: "BunRoute",
    load: loader,
  }
}

export const isBunRoute = (value: unknown): value is BunRoute => {
  return (
    typeof value === "object" &&
    value !== null &&
    TypeId in value
  )
}
