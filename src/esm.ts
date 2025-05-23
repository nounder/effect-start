import { Array, Iterable, Order, pipe, Record } from "effect"
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
export async function importJsBlob<M = unknown>(
  blob: Blob,
  entrypoint = "index.js",
): Promise<M> {
  return await importJsBundle({
    [entrypoint]: blob,
  }, entrypoint)
}

/**
 * Imports an entrypoint from multiple blobs.
 * Useful for loading code from build artifacts.
 *
 * Temporary files are wrriten to closest node_modules/ for node resolver
 * to pick up dependencies correctly and to avoid arbitrary file watchers
 * from detecting them.
 *
 * WARNING: dynamic imports that happened after this function will fail
 */
export async function importJsBundle<M = unknown>(
  blobs: {
    [path: string]: Blob
  },
  entrypoint: string,
  basePath = findNodeModules() + "/.tmp",
): Promise<M> {
  const sortedBlobs = pipe(
    blobs,
    Record.toEntries,
    Array.sortWith(v => v[0], Order.string),
    Array.map(v => v[1]),
  )
  const bundleBlob = new Blob(sortedBlobs)
  const hashPrefix = await hashBuffer(await bundleBlob.arrayBuffer())
    .then(v => v.slice(0, 8))
  const dir = `${basePath}/effect-bundler-${hashPrefix}`

  await NFSP.mkdir(dir, { recursive: true })

  await Promise.all(pipe(
    blobs,
    Record.toEntries,
    Array.map(([path, blob]) => {
      const fullPath = `${dir}/${path}`

      return blob
        .arrayBuffer()
        .then(v => NFSP.writeFile(fullPath, Buffer.from(v)))
    }),
  ))

  const bundleModule = await import(`${dir}/${entrypoint}`)

  await NFSP
    .rmdir(dir, { recursive: true })
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

  return pipe(
    new Uint8Array(hashBuffer),
    Iterable.map(b => b.toString(16).padStart(2, "0")),
    Iterable.reduce("", (a, b) => a + b),
  )
}
