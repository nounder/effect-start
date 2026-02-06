import * as NFS from "node:fs/promises"
import * as NPath from "node:path"

export const getEntrypoint = () => NPath.dirname(process.argv[1])

export const findClosestPackageJson = async (path: string): Promise<string | undefined> => {
  const resolved = NPath.resolve(path)
  const stat = await NFS.stat(resolved).catch(() => undefined)
  let dir = stat?.isDirectory() ? resolved : NPath.dirname(resolved)
  const root = NPath.parse(dir).root

  while (dir !== root) {
    const candidate = NPath.join(dir, "package.json")
    try {
      await NFS.access(candidate)
      return candidate
    } catch {
      dir = NPath.dirname(dir)
    }
  }

  return undefined
}
