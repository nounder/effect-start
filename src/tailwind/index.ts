import * as TailwindPlugin from "./TailwindPlugin.ts"
import { scanPathFromUrl } from "./plugin.ts"

export * as TailwindPlugin from "./TailwindPlugin.ts"

const scanPath = await scanPathFromUrl(import.meta.url)

export default TailwindPlugin.make({
  scanPath,
})
