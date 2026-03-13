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
const HTML_COMMENT_REGEX = /<!--[\s\S]*?-->/g
const TEMPLATE_EXPRESSION_REGEX = /\$\{[^}]*\}/g
const TAILWIND_CLASS_REGEX = /^[a-zA-Z0-9_:-]+(\[[^\]]*\])?$/
const CLASS_ATTRIBUTE_PATTERNS = [
  '\\sclass\\s*=\\s*"([^"]+)"',
  "\\sclass\\s*=\\s*'([^']+)'",
  '\\sclassName\\s*=\\s*"([^"]+)"',
  "\\sclassName\\s*=\\s*'([^']+)'",
  '\\sclassName\\s*=\\s*\\{\\s*"([^"]+)"\\s*\\}',
  "\\sclassName\\s*=\\s*\\{\\s*'([^']+)'\\s*\\}",
  "\\sclassName\\s*=\\s*\\{\\s*`([^`]*)`\\s*\\}",
  "\\sclass\\s*=\\s*\\{\\s*`([^`]*)`\\s*\\}",
  "\\sdata-class:([a-zA-Z0-9_:\\-]+(?:\\[[^\\]]*\\])?)\\s*=",
]

const CLASS_ATTRIBUTE_REGEX = new RegExp(
  CLASS_ATTRIBUTE_PATTERNS.map((pattern) => `(?:${pattern})`).join("|"),
  "g",
)

function hasCssImport(css: string, specifier?: string): boolean {
  const [, importPath] = css.match(CSS_IMPORT_REGEX) ?? []

  if (!importPath) return false

  return specifier === undefined || importPath.includes(specifier)
}

export function extractClassNames(source: string): Set<string> {
  const candidates = new Set<string>()
  const sourceWithoutComments = source.replace(HTML_COMMENT_REGEX, "")

  for (const tag of extractTagLikeSegments(sourceWithoutComments)) {
    for (const match of tag.matchAll(CLASS_ATTRIBUTE_REGEX)) {
      let classString = ""
      for (let i = 1; i < match.length; i++) {
        if (match[i] !== undefined) {
          classString = match[i]
          break
        }
      }

      if (!classString) {
        continue
      }

      if (classString.includes("${")) {
        const staticParts = classString.split(TEMPLATE_EXPRESSION_REGEX)

        for (const part of staticParts) {
          const names = part
            .trim()
            .split(/\s+/)
            .filter((name) => {
              if (name.length === 0) return false
              if (name.endsWith("-") || name.startsWith("-")) return false
              return TAILWIND_CLASS_REGEX.test(name)
            })
          names.forEach((name) => candidates.add(name))
        }
      } else {
        const names = classString.split(/\s+/).filter((name) => name.length > 0)
        names.forEach((name) => candidates.add(name))
      }
    }

  }

  return candidates
}

function extractTagLikeSegments(source: string): Array<string> {
  const tags: Array<string> = []

  for (let i = 0; i < source.length; i++) {
    if (source[i] !== "<") {
      continue
    }

    const next = source[i + 1]
    if (!next || next === "/" || next === "!" || /\s/.test(next)) {
      continue
    }

    let quote: '"' | "'" | "`" | null = null
    let escaped = false
    let braceDepth = 0

    for (let j = i + 1; j < source.length; j++) {
      const char = source[j]

      if (quote !== null) {
        if (escaped) {
          escaped = false
          continue
        }

        if (char === "\\") {
          escaped = true
          continue
        }

        if (char === quote) {
          quote = null
        }

        continue
      }

      if (char === '"' || char === "'" || char === "`") {
        quote = char
        continue
      }

      if (char === "{") {
        braceDepth++
        continue
      }

      if (char === "}" && braceDepth > 0) {
        braceDepth--
        continue
      }

      if (char === ">" && braceDepth === 0) {
        tags.push(source.slice(i, j + 1))
        i = j
        break
      }
    }
  }

  return tags
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
