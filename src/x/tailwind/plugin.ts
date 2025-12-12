import * as NPath from "node:path"
import * as BunTailwindPlugin from "../../bun/BunTailwindPlugin.ts"
import * as NodeUtils from "../../NodeUtils.ts"

// Append `?dir=` to module identifier to pass custom directory to scan
const dirParam = URL.parse(import.meta.url)?.searchParams.get("dir")
const packageJson = await NodeUtils.findClosestPackageJson(process.cwd())
const scanPath = dirParam
  ? NPath.resolve(process.cwd(), dirParam)
  : packageJson
  ? NPath.dirname(packageJson)
  : process.cwd()

// Export as default to be used in bunfig.toml
export default BunTailwindPlugin.make({
  scanPath,
})
