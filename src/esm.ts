import * as NFS from "node:fs"
import * as NFSP from "node:fs/promises"
import * as NPath from "node:path"
import * as process from "node:process"

/**
 * Imports a blob as a module.
 * Useful for loading code from build artifacts.
 *
 * Temporary files are wrriten to closest node_modules/ for node resolver
 * to pick up dependencies correctly and to avoid arbitrary file watchers
 * from detecting them.
 */
export async function importJsBlob<M = unknown>(blob: Blob): Promise<M> {
  const contents = await blob.arrayBuffer()
  const hashPrefix = await hashBuffer(contents)
    .then(v => v.slice(0, 8))
  const basePath = findNodeModules() + "/.tmp"
  const path = basePath + "/effect-bundler-"
    + hashPrefix + ".js"

  await NFSP.writeFile(path, Buffer.from(contents))

  const bundleModule = await import(path)

  await NFSP.unlink(path)
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

async function hashBuffer(buffer: BufferSource) {
  const hashBuffer = await crypto.subtle.digest("SHA-256", buffer)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  const hashHex = hashArray
    .map(b => b.toString(16).padStart(2, "0"))
    .join("")

  return hashHex
}
