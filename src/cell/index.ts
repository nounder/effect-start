import * as Cell from "./Cell.ts"

export {
  run,
} from "./Cell.ts"
export type {
  Cell,
  CellDeclaration,
  CellFunction,
  RunOptions,
  Runtime,
} from "./Cell.ts"
export {
  morph,
} from "./Dom.ts"

if (typeof window !== "undefined") {
  const key = "effect-start/cell/runtime"
  const browser = window as Window & { [key]?: ReturnType<typeof Cell.run> }
  browser[key]?.stop()
  browser[key] = Cell.run(document)
}
