import type * as Tailwind from "@tailwindcss/node"
import type { BunPlugin } from "bun"
import * as NPath from "node:path"

type Compiler = Awaited<ReturnType<typeof Tailwind.compile>>

export const make = (opts: {
  /**
   * Custom importer function to load Tailwind.
   * By default, it imports from '@tailwindcss/node'.
   * If you want to use a different version or a custom implementation,
   * provide your own importer.
   */
  importer?: () => Promise<typeof Tailwind>

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
} = {}): BunPlugin => {
  const {
    filesPattern = /\.(jsx?|tsx?|html|svelte|vue|astro)$/,
    cssPattern = /\.css$/,
    importer = () =>
      import("@tailwindcss/node").catch(err => {
        throw new Error(
          "Tailwind not found: install @tailwindcss/node or provide custom importer option",
        )
      }),
  } = opts

  return {
    name: "Bun Tailwind.css plugin",
    target: "browser",
    async setup(builder) {
      const Tailwind = await importer()

      const scannedCandidates = new Set<string>()
      // (file) -> (class names)
      const classNameCandidates = new Map<string, Set<string>>()
      // (importer path) -> (imported paths)
      const importAncestors = new Map<string, Set<string>>()
      // (imported path) -> (importer paths)
      const importDescendants = new Map<string, Set<string>>()

      if (opts.scanPath) {
        const candidates = await scanFiles(opts.scanPath)

        candidates.forEach(candidate => scannedCandidates.add(candidate))
      }

      /**
       * Track import relationships when dynamically scanning
       * from tailwind entrypoints.
       *
       * As of Bun 1.3 this pathway break for Bun Full-Stack server.
       * Better to pass scanPath explicitly.
       * @see https://github.com/oven-sh/bun/issues/20877
       */
      if (!opts.scanPath) {
        builder.onResolve({
          filter: /.*/,
        }, (args) => {
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
        })
      }

      /**
       * Scan for class name candidates in component files.
       */
      builder.onLoad({
        filter: filesPattern,
      }, async (args) => {
        const contents = await Bun.file(args.path).text()
        const classNames = extractClassNames(contents)

        if (classNames.size > 0) {
          classNameCandidates.set(args.path, classNames)
        }

        return undefined
      })

      /**
       * Compile tailwind entrypoints.
       */
      builder.onLoad({
        filter: cssPattern,
      }, async (args) => {
        const source = await Bun.file(args.path).text()

        if (!hasCssImport(source, "tailwindcss")) {
          return undefined
        }

        const compiler = await Tailwind.compile(source, {
          base: NPath.dirname(args.path),
          shouldRewriteUrls: true,
          onDependency: (path) => {},
        })

        // wait for other files to be loaded so we can collect class name candidates
        await args.defer()

        const candidates = new Set<string>()

        scannedCandidates.forEach(candidate => candidates.add(candidate))

        {
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

            moduleImports?.forEach(moduleImport => {
              const moduleCandidates = classNameCandidates.get(moduleImport)

              moduleCandidates?.forEach(candidate => candidates.add(candidate))

              pendingModules.push(moduleImport)
            })

            visitedModules.add(currentPath)
          }
        }

        const contents = compiler.build([
          ...candidates,
        ])

        return {
          contents,
          loader: "css",
        }
      })
    },
  }
}

const CSS_IMPORT_REGEX = /@import\s+(?:url\()?["']?([^"')]+)["']?\)?\s*[^;]*;/
const HTML_COMMENT_REGEX = /<!--[\s\S]*?-->/g
const TEMPLATE_EXPRESSION_REGEX = /\$\{[^}]*\}/g
const TAILWIND_CLASS_REGEX = /^[a-zA-Z0-9_:-]+(\[[^\]]*\])?$/
const CLASS_NAME_PATTERNS = [
  // HTML class attributes with double quotes: <div class="bg-blue-500 text-white">
  "<[^>]*?\\sclass\\s*=\\s*\"([^\"]+)\"",

  // HTML class attributes with single quotes: <div class='bg-blue-500 text-white'>
  "<[^>]*?\\sclass\\s*=\\s*'([^']+)'",

  // JSX className attributes with double quotes: <div className="bg-blue-500 text-white">
  "<[^>]*?\\sclassName\\s*=\\s*\"([^\"]+)\"",

  // JSX className attributes with single quotes: <div className='bg-blue-500 text-white'>
  "<[^>]*?\\sclassName\\s*=\\s*'([^']+)'",

  // JSX className with braces and double quotes: <div className={"bg-blue-500 text-white"}>
  "<[^>]*?\\sclassName\\s*=\\s*\\{\\s*\"([^\"]+)\"\\s*\\}",

  // JSX className with braces and single quotes: <div className={'bg-blue-500 text-white'}>
  "<[^>]*?\\sclassName\\s*=\\s*\\{\\s*'([^']+)'\\s*\\}",

  // JSX className with template literals: <div className={`bg-blue-500 ${variable}`}>
  "<[^>]*?\\sclassName\\s*=\\s*\\{\\s*`([^`]*)`\\s*\\}",

  // HTML class with template literals: <div class={`bg-blue-500 ${variable}`}>
  "<[^>]*?\\sclass\\s*=\\s*\\{\\s*`([^`]*)`\\s*\\}",

  // HTML class at start of tag with double quotes: <div class="bg-blue-500">
  "<\\w+\\s+class\\s*=\\s*\"([^\"]+)\"",

  // HTML class at start of tag with single quotes: <div class='bg-blue-500'>
  "<\\w+\\s+class\\s*=\\s*'([^']+)'",

  // JSX className at start of tag with double quotes: <div className="bg-blue-500">
  "<\\w+\\s+className\\s*=\\s*\"([^\"]+)\"",

  // JSX className at start of tag with single quotes: <div className='bg-blue-500'>
  "<\\w+\\s+className\\s*=\\s*'([^']+)'",

  // JSX className at start with braces and double quotes: <div className={"bg-blue-500"}>
  "<\\w+\\s+className\\s*=\\s*\\{\\s*\"([^\"]+)\"\\s*\\}",

  // JSX className at start with braces and single quotes: <div className={'bg-blue-500'}>
  "<\\w+\\s+className\\s*=\\s*\\{\\s*'([^']+)'\\s*\\}",

  // JSX className at start with template literals: <div className={`bg-blue-500 ${variable}`}>
  "<\\w+\\s+className\\s*=\\s*\\{\\s*`([^`]*)`\\s*\\}",

  // HTML class at start with template literals: <div class={`bg-blue-500 ${variable}`}>
  "<\\w+\\s+class\\s*=\\s*\\{\\s*`([^`]*)`\\s*\\}",
]

const CLASS_NAME_REGEX = new RegExp(
  CLASS_NAME_PATTERNS.map(pattern => `(?:${pattern})`).join("|"),
  "g",
)

function hasCssImport(css: string, specifier?: string): boolean {
  const [, importPath] = css.match(CSS_IMPORT_REGEX) ?? []

  if (!importPath) return false

  return specifier === undefined
    || importPath.includes(specifier)
}

export function extractClassNames(source: string): Set<string> {
  const candidates = new Set<string>()
  const sourceWithoutComments = source.replace(HTML_COMMENT_REGEX, "")

  for (const match of sourceWithoutComments.matchAll(CLASS_NAME_REGEX)) {
    // Find the first non-undefined capture group (skip match[0] which is full match)
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
        const names = part.trim().split(/\s+/).filter(name => {
          if (name.length === 0) return false
          if (name.endsWith("-") || name.startsWith("-")) return false
          return TAILWIND_CLASS_REGEX.test(name)
        })
        names.forEach(name => candidates.add(name))
      }
    } else {
      // Simple case: regular class string without expressions
      const names = classString.split(/\s+/).filter(name => name.length > 0)
      names.forEach(name => candidates.add(name))
    }
  }

  return candidates
}

async function scanFiles(dir: string): Promise<Set<string>> {
  const candidates = new Set<string>()
  const glob = new Bun.Glob("**/*.{js,jsx,ts,tsx,html,vue,svelte,astro}")

  for await (
    const filePath of glob.scan({
      cwd: dir,
      absolute: true,
    })
  ) {
    const contents = await Bun.file(filePath).text()
    const classNames = extractClassNames(contents)

    classNames.forEach((className) => candidates.add(className))
  }

  return candidates
}
