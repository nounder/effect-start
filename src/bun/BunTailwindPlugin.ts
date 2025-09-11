import type * as Tailwind from "@tailwindcss/node"
import type { BunPlugin } from "bun"
import * as NodePath from "node:path"

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
        const candidates = await scanFiles(opts.scanPath, filesPattern)

        candidates.forEach(candidate => scannedCandidates.add(candidate))
      }

      /**
       * Track import relationships.
       * We do this to scope all class name candidates to tailwind entrypoints
       */
      builder.onResolve({
        filter: /.*/,
      }, (args) => {
        const fullPath = Bun.resolveSync(args.path, args.resolveDir)

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

          if (!importAncestors.has(args.importer)) {
            importAncestors.set(args.importer, new Set())
          }

          if (!importDescendants.has(args.importer)) {
            importDescendants.set(args.importer, new Set())
          }
        }

        importAncestors.get(fullPath)!.add(args.importer)
        importDescendants.get(args.importer)!.add(fullPath)

        return undefined
      })

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
          base: NodePath.dirname(args.path),
          shouldRewriteUrls: true,
          onDependency: (path) => {},
        })

        // wait for other files to be loaded so we can collect class name candidates
        // NOTE: at currently processed css won't be in import graph because
        // we haven't returned its contents yet.
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

function hasCssImport(css: string, specifier?: string): boolean {
  const [, importPath] = css.match(CSS_IMPORT_REGEX) ?? []

  if (!importPath) return false

  return specifier === undefined
    || importPath.includes(specifier)
}

const CLASS_NAME_REGEX = /^[^"'`\s]+$/

function extractClassNames(source: string): Set<string> {
  const classNames = new Set<string>()

  // Extract all string literals from the source
  const stringLiteralRegex = /["'`]([^"'`]+)["'`]/g
  let match

  while ((match = stringLiteralRegex.exec(source)) !== null) {
    const content = match[1]

    // Split by whitespace and filter for valid Tailwind class patterns
    const potentialClasses = content.split(/\s+/)

    for (const className of potentialClasses) {
      // Validate Tailwind-like classes with a single regex
      if (CLASS_NAME_REGEX.test(className)) {
        classNames.add(className)
      }
    }
  }

  return classNames
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
