import * as Runtime from "./Runtime.ts"

export {
  morph,
} from "./Dom.ts"
export {
  start,
} from "./Runtime.ts"
export type {
  Cell,
  CellDeclaration,
  CellFunction,
  Runtime,
  StartOptions,
} from "./types.ts"

if (typeof window !== "undefined") {
  const key = "effect-start/cell/runtime"
  const browser = window as Window & { [key]?: ReturnType<typeof Runtime.start> }
  browser[key]?.stop()
  browser[key] = Runtime.start(document)
}
