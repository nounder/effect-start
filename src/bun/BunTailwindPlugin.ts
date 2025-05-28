import * as Tailwind from "@tailwindcss/node"
import type { BunPlugin } from "bun"
import { Iterable } from "effect"

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
   * Patterm to match component and HTML files for class name extraction.
   */
  filesPattern?: RegExp
  /**
   * Pattern to match CSS files that import Tailwind.
   */
  cssPattern?: RegExp
} = {}): BunPlugin => {
  const {
    filesPattern = /\.(tsx|jsx|html|svelte|vue|astro)$/,
    cssPattern = /\.css$/,
    importer = () =>
      import("@tailwindcss/node").catch(err => {
        throw new Error(
          "Tailwind not found: install @tailwindcss/node or provide custom importer",
        )
      }),
  } = opts

  return {
    name: "Bun Tailwind.css plugin",
    async setup(builder) {
      const Tailwind = await importer()

      // (file) -> (class names)
      const classNameCandidates = new Map<string, Set<string>>()
      // (importer path) -> (imported paths)
      const importAncestors = new Map<string, Set<string>>()
      // (imported path) -> (importer paths)
      const importDescendants = new Map<string, Set<string>>()

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

        // Bypass CSS files that do not import 'tailwindcss'
        if (!hasTailwindImport(source)) {
          return undefined
        }

        const compiler = await Tailwind.compile(source, {
          base: process.cwd(),
          onDependency: (path) => {},
        })

        // wait for other files to be loaded so we can collect class name candidates
        // NOTE: at currently processed css won't be in import graph because
        // we haven't returned its contents yet.
        await args.defer()

        const candidates = new Set<string>()
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
          }
        }

        const contents = compiler.build([...candidates])

        return {
          contents,
          loader: "css",
        }
      })
    },
  }
}

function hasTailwindImport(css: string): boolean {
  return /@import\s+(url\()?["']?[^"')]+["']?\)?\s*[^;]*;/.test(css)
}

const CLASS_NAME_REGEX =
  /^[a-zA-Z0-9\-_:\[\]\/\.!]*([-:\[\/]|^(h|w|p|m|text|bg|border|rounded|shadow|flex|grid|size|gap|ring|outline|opacity|pointer|transition|shrink|grow|items|justify|font|underline|has|aria|inline|block|hidden|visible|static|fixed|absolute|relative|sticky))/

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
