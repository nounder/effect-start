import type * as Fiber from "effect/Fiber"

const mainFiberKey = Symbol.for("effect-start/BunRuntime/mainFiber")
const globalRegistry = globalThis as typeof globalThis & {
  [mainFiberKey]?: Fiber.Fiber<unknown, unknown>
}

export const get = (): Fiber.Fiber<unknown, unknown> | undefined => globalRegistry[mainFiberKey]

export const set = (fiber: Fiber.Fiber<unknown, unknown>): void => {
  globalRegistry[mainFiberKey] = fiber
}

export const clear = (fiber: Fiber.Fiber<unknown, unknown>): void => {
  if (globalRegistry[mainFiberKey] === fiber) delete globalRegistry[mainFiberKey]
}
