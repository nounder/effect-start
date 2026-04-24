import * as NPath from "node:path"
import * as NodeUtils from "../node/NodeUtils.ts"
import * as TailwindPlugin from "./TailwindPlugin.ts"

export const scanPathFromUrl = async (url: string) => {
  const dirParam = URL.parse(url)?.searchParams.get("dir")
  const packageJson = await NodeUtils.findClosestPackageJson(process.cwd())

  return dirParam
    ? NPath.resolve(process.cwd(), dirParam)
    : packageJson
      ? NPath.dirname(packageJson)
      : process.cwd()
}

// Export as default to be used in bunfig.toml
export default TailwindPlugin.make({
  scanPath: await scanPathFromUrl(import.meta.url),
})
