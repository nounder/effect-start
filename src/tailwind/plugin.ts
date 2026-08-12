import * as BunPlugin from "../bun/BunPlugin.ts"
import * as TailwindPlugin from "./TailwindPlugin.ts"

// Export as default to be used in bunfig.toml
export default BunPlugin.toBunPlugin(TailwindPlugin.make(), { target: "browser" })
