import * as NPath from "node:path"
import * as NodeUtils from "../../node/NodeUtils.ts"
import * as TailwindPlugin from "./TailwindPlugin.ts"

// Append `?dir=` to module identifier to pass custom directory to scan
const dirParam = URL.parse(import.meta.url)?.searchParams.get("dir")
const packageJson = await NodeUtils.findClosestPackageJson(process.cwd())
const scanPath = dirParam
  ? NPath.resolve(process.cwd(), dirParam)
  : packageJson
  ? NPath.dirname(packageJson)
  : process.cwd()

// Export as default to be used in bunfig.toml
export default TailwindPlugin.make({
  scanPath,
})
