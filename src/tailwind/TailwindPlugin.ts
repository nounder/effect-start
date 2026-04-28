import type { BunPlugin } from "bun"
import * as NPath from "node:path"
import * as Tailwind from "./compile.ts"

export const make = (opts?: {
  /**
   * Pattern to match component and HTML files for class name extraction.
   */
  filesPattern?: RegExp

  /**
   * Pattern to match CSS files that import Tailwind.
   */
  cssPattern?: RegExp

  /**
   * Scan a path for candidates.
   * By default, only class names found in files that are part of the import graph
   * that imports tailwind are considered.
   *
   * This option scans the provided path and ensures that class names found under this path
   * are includedd, even if they are not part of the import graph.
   * Useful when we want to scan clientside code which is not imported directly on serverside.
   */
  scanPath?: string

  target?: "browser" | "bun" | "node"
}): BunPlugin => {
  const {
    filesPattern = /\.(jsx?|tsx?|html|svelte|vue|astro)$/,
    cssPattern = /\.css$/,
    target = "browser",
  } = opts ?? {}

  return {
    name: "Tailwind.css plugin",
    target,
    async setup(builder) {
      const scannedCandidates = new Set<string>()
      // (file) -> (class names)
      const classNameCandidates = new Map<string, Set<string>>()
      // (importer path) -> (imported paths)
      const importAncestors = new Map<string, Set<string>>()
      // (imported path) -> (importer paths)
      const importDescendants = new Map<string, Set<string>>()

      const prepopulateCandidates = opts?.scanPath
        ? async () => {
            const candidates = await scanFiles(opts.scanPath!)

            scannedCandidates.clear()

            candidates.forEach((candidate) => scannedCandidates.add(candidate))
          }
        : null

      // Track import relationships when dynamically scanning
      // from tailwind entrypoints.
      // As of Bun 1.3 this pathway break for Bun Full-Stack server.
      // Better to pass scanPath explicitly.
      // @see https://github.com/oven-sh/bun/issues/20877
      if (!prepopulateCandidates) {
        builder.onResolve(
          {
            filter: /.*/,
          },
          (args) => {
            const fullPath = Bun.resolveSync(args.path, args.resolveDir)
            const importer = args.importer

            if (fullPath.includes("/node_modules/")) {
              return undefined
            }

            /**
             * Register every visited module.
             */
            {
              if (!importAncestors.has(fullPath)) {
                importAncestors.set(fullPath, new Set())
              }

              if (!importDescendants.has(fullPath)) {
                importDescendants.set(fullPath, new Set())
              }

              if (!importAncestors.has(importer)) {
                importAncestors.set(args.importer, new Set())
              }

              if (!importDescendants.has(importer)) {
                importDescendants.set(importer, new Set())
              }
            }

            importAncestors.get(fullPath)!.add(importer)
            importDescendants.get(importer)!.add(fullPath)

            return undefined
          },
        )
      }

      /**
       * Scan for class name candidates in component files.
       */
      builder.onLoad(
        {
          filter: filesPattern,
        },
        async (args) => {
          const contents = await Bun.file(args.path).text()
          const classNames = extractClassNames(contents)

          if (classNames.size > 0) {
            classNameCandidates.set(args.path, classNames)
          }

          return undefined
        },
      )

      /**
       * Compile tailwind entrypoints.
       */
      builder.onLoad(
        {
          filter: cssPattern,
        },
        async (args) => {
          const source = await Bun.file(args.path).text()

          if (!hasCssImport(source, "tailwindcss")) {
            return undefined
          }

          const compiler = await Tailwind.compile(source, {
            base: NPath.dirname(args.path),
            onDependency: (path) => {},
          })

          await prepopulateCandidates?.()

          // wait for other files to be loaded so we can collect class name candidates
          await args.defer()

          const candidates = new Set<string>(scannedCandidates)

          // when we scan a path, we don't need to track candidate tree
          if (!prepopulateCandidates) {
            const pendingModules = [
              // get class name candidates from all modules that import this one
              ...(importAncestors.get(args.path) ?? []),
            ]
            const visitedModules = new Set<string>()

            while (pendingModules.length > 0) {
              const currentPath = pendingModules.shift()!

              if (visitedModules.has(currentPath)) {
                continue
              }

              const moduleImports = importDescendants.get(currentPath)

              moduleImports?.forEach((moduleImport) => {
                const moduleCandidates = classNameCandidates.get(moduleImport)

                moduleCandidates?.forEach((candidate) => candidates.add(candidate))

                pendingModules.push(moduleImport)
              })

              visitedModules.add(currentPath)
            }
          }

          const contents = compiler.build([...candidates])

          return {
            contents,
            loader: "css",
          }
        },
      )
    },
  }
}

const CSS_IMPORT_REGEX = /@import\s+(?:url\()?["']?([^"')]+)["']?\)?\s*[^;]*;/

function hasCssImport(css: string, specifier?: string): boolean {
  const [, importPath] = css.match(CSS_IMPORT_REGEX) ?? []

  if (!importPath) return false

  return specifier === undefined || importPath.includes(specifier)
}

/**
 * Extract Tailwind candidate class names from arbitrary source text.
 *
 * Mirrors Tailwind v4's plain-text scanning rules: the whole file is treated
 * as text, tokens are split on Tailwind's boundary characters, and any token
 * shaped like a candidate is emitted. The Tailwind compiler discards tokens
 * that don't map to known utilities, so over-matching here is expected.
 *
 * @see https://tailwindcss.com/docs/detecting-classes-in-source-files
 * @see https://github.com/tailwindlabs/tailwindcss/blob/main/crates/oxide/src/extractor/boundary.rs
 */
export function extractClassNames(source: string): Set<string> {
  const candidates = new Set<string>()
  const len = source.length
  let i = 0

  while (i < len) {
    if (!isBeforeBoundary(i === 0 ? "\0" : source[i - 1])) {
      i++
      continue
    }

    const token = readCandidate(source, i)

    if (token === null) {
      i++
      continue
    }

    const after = token.end >= len ? "\0" : source[token.end]
    if (!isAfterBoundary(after)) {
      i = token.end
      continue
    }

    candidates.add(token.value)

    // Datastar convention: data-class:<utility>="..." conditionally applies <utility>.
    // The plain-text token is "data-class:<utility>"; surface the utility part too.
    if (token.value.startsWith("data-class:")) {
      const inner = token.value.slice("data-class:".length)
      if (inner.length > 0) candidates.add(inner)
    }

    i = token.end
  }

  return candidates
}

const BOUNDARY_COMMON = new Set([" ", "\t", "\n", "\r", "\f", '"', "'", "`", "\0"])
const BOUNDARY_BEFORE_ONLY = new Set([".", "}", ">"])
const BOUNDARY_AFTER_ONLY = new Set(["]", "{", "=", "\\", "<"])

function isBeforeBoundary(ch: string): boolean {
  return BOUNDARY_COMMON.has(ch) || BOUNDARY_BEFORE_ONLY.has(ch)
}

function isAfterBoundary(ch: string): boolean {
  return BOUNDARY_COMMON.has(ch) || BOUNDARY_AFTER_ONLY.has(ch)
}

function isLower(ch: string): boolean {
  return ch >= "a" && ch <= "z"
}

function isAlpha(ch: string): boolean {
  return (ch >= "a" && ch <= "z") || (ch >= "A" && ch <= "Z")
}

function isAlphaNum(ch: string): boolean {
  return isAlpha(ch) || (ch >= "0" && ch <= "9")
}

function isDigit(ch: string): boolean {
  return ch >= "0" && ch <= "9"
}

interface ReadResult {
  value: string
  end: number
}

/**
 * Read a single Tailwind candidate starting at `start`. Returns null when the
 * position cannot begin a valid candidate. The returned `end` is the index
 * one past the last consumed character.
 */
function readCandidate(source: string, start: number): ReadResult | null {
  const len = source.length
  let i = start

  // Optional leading "!" (legacy important).
  let importantPrefix = false
  if (source[i] === "!") {
    importantPrefix = true
    i++
    if (i >= len) return null
  }

  // Read variant chain: <variant>:<variant>:...:<utility>
  // Each variant ends in ":". A variant can be a name (with same shape as a
  // utility minus arbitrary value), an arbitrary "[...]" expression, or the
  // child selectors "*" / "**".
  while (true) {
    const variantStart = i
    const variantEnd = readVariantOrUtility(source, i)
    if (variantEnd === null) {
      return i === start || (importantPrefix && i === start + 1) ? null : null
    }
    if (source[variantEnd] === ":") {
      // Consumed a variant; loop for the next segment.
      i = variantEnd + 1
      if (i >= len) return null
      continue
    }
    // No trailing ":" — this segment is the utility. We're done with the body.
    i = variantEnd
    // Re-check: a variant that's just "*"/"**" without ":" is not a utility.
    if (variantStart === start && !importantPrefix) {
      const head = source[start]
      if (head === "*") return null
    }
    break
  }

  // Optional "/modifier".
  if (source[i] === "/") {
    const modEnd = readModifier(source, i + 1)
    if (modEnd !== null) i = modEnd
  }

  // Optional trailing "!" (modern important). Cannot combine with leading "!".
  if (!importantPrefix && source[i] === "!") {
    i++
  }

  if (i === start || (importantPrefix && i === start + 1)) return null

  return { value: source.slice(start, i), end: i }
}

/**
 * Read either a variant or a utility body starting at `i`. Returns the end
 * index, or null if nothing valid was consumed. The caller decides whether
 * the next char (":") promotes this to a variant.
 */
function readVariantOrUtility(source: string, start: number): number | null {
  const len = source.length
  let i = start
  if (i >= len) return null
  const head = source[i]

  // Arbitrary property/variant: "[...]"
  if (head === "[") {
    const end = skipBracketed(source, i, "[", "]")
    return end === null ? null : end
  }

  // Child variants "*" and "**"
  if (head === "*") {
    i++
    if (source[i] === "*") i++
    return i
  }

  // "@" container queries (e.g. @container, @lg, @max-md)
  if (head === "@") {
    i++
    return readNameBody(source, i)
  }

  // Negative utility: "-<lower>..."
  if (head === "-") {
    if (!source[i + 1] || !isLower(source[i + 1])) return null
    i++
    return readNameBody(source, i)
  }

  // Normal utility: must start with a lowercase letter.
  if (!isLower(head)) return null
  return readNameBody(source, i)
}

/**
 * Read a utility name body starting at `start`. The first char is assumed to
 * already be valid for starting (lowercase letter, or has been consumed). We
 * accept letters / digits / "_" / "-" / "." (positional rules) plus embedded
 * "[...]" and "(...)" runs. Returns the end index.
 */
function readNameBody(source: string, start: number): number {
  const len = source.length
  let i = start

  while (i < len) {
    const ch = source[i]
    if (isAlphaNum(ch) || ch === "_") {
      i++
      continue
    }
    if (ch === "-") {
      const next = source[i + 1]
      // "-" must be followed by alnum, "-", "[", or "(" to remain in the name.
      if (next === undefined) break
      if (isAlphaNum(next) || next === "-" || next === "[" || next === "(") {
        i++
        continue
      }
      break
    }
    if (ch === ".") {
      // "." valid only between digits.
      const prev = source[i - 1]
      const next = source[i + 1]
      if (isDigit(prev) && isDigit(next)) {
        i++
        continue
      }
      break
    }
    if (ch === "%") {
      // "%" valid only directly after a digit; ends the name.
      const prev = source[i - 1]
      if (isDigit(prev)) {
        i++
      }
      break
    }
    if (ch === "[") {
      const end = skipBracketed(source, i, "[", "]")
      if (end === null) break
      i = end
      continue
    }
    if (ch === "(") {
      const end = skipBracketed(source, i, "(", ")")
      if (end === null) break
      i = end
      continue
    }
    break
  }

  // Disallow trailing "-" / "_" / ".".
  while (i > start) {
    const last = source[i - 1]
    if (last === "-" || last === "_" || last === ".") {
      i--
      continue
    }
    break
  }

  return i
}

/**
 * Consume a bracketed run starting at `start` (which must be `open`). Tracks
 * nested brackets (mixing of "[]" and "()" both supported via stack). Returns
 * the index one past the matching close, or null if unmatched / contains a
 * disallowed boundary char (raw whitespace breaks the candidate; Tailwind
 * uses "_" as the in-bracket space).
 */
function skipBracketed(source: string, start: number, open: string, close: string): number | null {
  const len = source.length
  if (source[start] !== open) return null
  const stack: Array<string> = [close]
  let i = start + 1
  while (i < len) {
    const ch = source[i]
    if (ch === "[") {
      stack.push("]")
      i++
      continue
    }
    if (ch === "(") {
      stack.push(")")
      i++
      continue
    }
    if (ch === "]" || ch === ")") {
      const expected = stack[stack.length - 1]
      if (ch !== expected) return null
      stack.pop()
      i++
      if (stack.length === 0) return i
      continue
    }
    // Raw whitespace, "$", "`", "{", "}" break a candidate. Tailwind v4 uses
    // "_" as the in-bracket space placeholder, and template-literal "${...}"
    // interpolation invalidates the surrounding arbitrary value.
    if (
      ch === " " ||
      ch === "\t" ||
      ch === "\n" ||
      ch === "\r" ||
      ch === "\f" ||
      ch === "$" ||
      ch === "`" ||
      ch === "{" ||
      ch === "}"
    ) {
      return null
    }
    i++
  }
  return null
}

/**
 * Read a "/modifier" body. The modifier can be a name (alnum/_/-) optionally
 * ending with "%", an arbitrary "[...]", or a CSS variable "(...)". Returns
 * the end index (one past the modifier) or null if empty.
 */
function readModifier(source: string, start: number): number | null {
  const len = source.length
  if (start >= len) return null
  const head = source[start]
  if (head === "[") return skipBracketed(source, start, "[", "]")
  if (head === "(") return skipBracketed(source, start, "(", ")")

  let i = start
  while (i < len) {
    const ch = source[i]
    if (isAlphaNum(ch) || ch === "_" || ch === "-" || ch === ".") {
      i++
      continue
    }
    if (ch === "%") {
      i++
      break
    }
    break
  }
  return i === start ? null : i
}

async function scanFiles(dir: string): Promise<Set<string>> {
  const candidates = new Set<string>()
  const glob = new Bun.Glob("**/*.{js,jsx,ts,tsx,html,vue,svelte,astro}")

  for await (const filePath of glob.scan({
    cwd: dir,
    absolute: true,
  })) {
    if (filePath.includes("/node_modules/")) {
      continue
    }

    const contents = await Bun.file(filePath).text()
    const classNames = extractClassNames(contents)

    classNames.forEach((className) => candidates.add(className))
  }

  return candidates
}
