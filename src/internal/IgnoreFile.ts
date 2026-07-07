import type { Dirent } from "node:fs"
import * as NFSSync from "node:fs"
import * as NFS from "node:fs/promises"
import * as NPath from "node:path"

interface Pattern {
  readonly source: string
  readonly negate: boolean
  /** matches directories only (e.g. `build/`) */
  readonly directoryOnly: boolean
  /**  matches relative to the ignore file's dir, not anywhere in the tree. */
  readonly anchored: boolean
  readonly regex: RegExp
}

interface IgnoreFile {
  readonly dir: string
  readonly patterns: ReadonlyArray<Pattern>
}

interface IgnoreStack {
  readonly push: (file: IgnoreFile) => void
  readonly pop: () => void
  readonly matches: (absolutePath: string, isDir: boolean) => boolean
  readonly size: () => number
}

const parse = (dir: string, content: string): IgnoreFile => {
  const patterns: Array<Pattern> = []
  const lines = content.split(/\r?\n/)
  for (const raw of lines) {
    const line = stripTrailingUnescapedSpaces(raw)
    if (line.length === 0 || line.startsWith("#")) continue
    patterns.push(compile(line))
  }
  return { dir, patterns }
}

const make = (): IgnoreStack => {
  const files: Array<IgnoreFile> = []

  const matches = (absolutePath: string, isDir: boolean): boolean => {
    let ignored = false
    for (let i = 0; i < files.length; i++) {
      const frame = files[i]
      const rel = relativeUnder(frame.dir, absolutePath)
      if (rel === null) continue
      for (const pattern of frame.patterns) {
        if (pattern.directoryOnly && !isDir) continue
        if (pattern.regex.test(rel)) {
          ignored = !pattern.negate
        }
      }
    }
    return ignored
  }

  return {
    push: (file) => {
      files.push(file)
    },
    pop: () => {
      files.pop()
    },
    matches,
    size: () => files.length,
  }
}

const relativeUnder = (base: string, target: string): string | null => {
  const rel = NPath.relative(base, target)
  if (rel.startsWith("..") || NPath.isAbsolute(rel)) return null
  return rel.split(NPath.sep).join("/")
}

const stripTrailingUnescapedSpaces = (line: string): string => {
  let end = line.length
  while (end > 0 && line[end - 1] === " " && line[end - 2] !== "\\") end--
  return line.slice(0, end)
}

const compile = (input: string): Pattern => {
  let source = input
  const negate = source.startsWith("!")
  if (negate) source = source.slice(1)

  const directoryOnly = source.endsWith("/")
  if (directoryOnly) source = source.slice(0, -1)

  const anchored = source.includes("/") && !source.startsWith("**/")
  if (source.startsWith("/")) source = source.slice(1)

  return {
    source: input,
    negate,
    directoryOnly,
    anchored,
    regex: globToRegex(source, anchored),
  }
}

type WalkSignal = "abort" | "pass" | undefined

type Visit = (item: { path: string; entry: Dirent }) => WalkSignal

/**
 * Recursively walk `root`, applying `.gitignore` rules found at each level
 * (plus any `.gitignore`s above `root`, between it and the filesystem root).
 *
 * `visit` is called for every non-ignored entry. Return `"abort"` to stop the
 * entire walk, `"pass"` to skip descending into a directory, or nothing to
 * continue.
 */
export const walk = async (root: string, visit: Visit): Promise<void> => {
  const stack = make()
  const resolved = NPath.resolve(root)

  let dir = resolved
  const ancestors: Array<string> = []
  while (true) {
    const parent = NPath.dirname(dir)
    if (parent === dir) break
    ancestors.unshift(parent)
    dir = parent
  }
  for (const d of ancestors) await pushIgnore(stack, d)

  await walkInto(resolved, stack, visit)
}

const pushIgnore = async (
  stack: IgnoreStack,
  dir: string,
): Promise<boolean> => {
  const path = NPath.join(dir, ".gitignore")
  const stat = NFSSync.statSync(path, { throwIfNoEntry: false })
  if (!stat?.isFile()) return false
  const content = await NFS.readFile(path, "utf8")
  stack.push(parse(dir, content))
  return true
}

const walkInto = async (
  dir: string,
  stack: IgnoreStack,
  visit: Visit,
): Promise<WalkSignal> => {
  const pushed = await pushIgnore(stack, dir)

  let entries: Array<Dirent>
  try {
    entries = await NFS.readdir(dir, { withFileTypes: true })
  } catch {
    if (pushed) stack.pop()
    return undefined
  }

  for (const entry of entries) {
    const path = NPath.join(dir, entry.name)
    const isDir = entry.isDirectory()
    if (stack.matches(path, isDir)) continue
    const signal = visit({ path, entry })
    if (signal === "abort") {
      if (pushed) stack.pop()
      return "abort"
    }
    if (isDir && signal !== "pass") {
      const inner = await walkInto(path, stack, visit)
      if (inner === "abort") {
        if (pushed) stack.pop()
        return "abort"
      }
    }
  }

  if (pushed) stack.pop()
  return undefined
}

const globToRegex = (glob: string, anchored: boolean): RegExp => {
  let re = ""
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i]
    if (c === "*") {
      if (glob[i + 1] === "*") {
        re += ".*"
        i++
        if (glob[i + 1] === "/") i++
      } else {
        re += "[^/]*"
      }
    } else if (c === "?") {
      re += "[^/]"
    } else if (c === ".") {
      re += "\\."
    } else if (c === "/") {
      re += "/"
    } else if (/[\\^$+(){}|[\]]/.test(c)) {
      re += "\\" + c
    } else {
      re += c
    }
  }
  const prefix = anchored ? "^" : "(^|.*/)"
  return new RegExp(prefix + re + "(/.*)?$")
}
