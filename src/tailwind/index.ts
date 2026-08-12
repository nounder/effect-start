import * as BunPlugin from "../bun/BunPlugin.ts"
import * as TailwindPlugin from "./TailwindPlugin.ts"

export * as TailwindPlugin from "./TailwindPlugin.ts"

export default BunPlugin.toBunPlugin(TailwindPlugin.make(), { target: "browser" })
