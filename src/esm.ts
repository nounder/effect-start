import * as NFS from "node:fs"
import * as NPath from "node:path"
import * as process from "node:process"

/**
 * Imports a blob as a module.
 * Useful for loading code from build artifacts.
 */
export async function importJsBlob<M = unknown>(blob: Blob): Promise<M> {
  const contents = await blob.arrayBuffer()
  const hash = Bun.hash(contents)
  const basePath = findNodeModules() + "/.tmp"
  const path = basePath + "/effect-bundler-"
    + hash.toString(16) + ".js"

  const file = Bun.file(path)
  await file.write(contents)

  const bundleModule = await import(path)

  await file.delete()
    // if called concurrently, file sometimes may be deleted
    // safe ignore when this happens
    .catch(() => {})

  return bundleModule
}

export function findNodeModules(startDir = process.cwd()) {
  let currentDir = NPath.resolve(startDir)

  while (currentDir !== NPath.parse(currentDir).root) {
    const nodeModulesPath = NPath.join(currentDir, "node_modules")
    if (
      NFS.statSync(nodeModulesPath).isDirectory()
    ) {
      return nodeModulesPath
    }

    currentDir = NPath.dirname(currentDir)
  }

  return null
}
