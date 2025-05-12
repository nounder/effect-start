import type { BunPlugin } from "bun"
import { Array } from "effect"

export const make = (importer?: () => Promise<any>): BunPlugin => {
  return {
    name: "Bun Tailwind.css plugin",
    async setup(builder) {
      const Tailwind = await (importer
        ? importer()
        // @ts-ignore it's okay if it's not installed
        : import("@tailwindcss/node").catch(err => {
          throw new Error(
            "Tailwind not found: install @tailwindcss/node or provide custom importer",
          )
        }))
      const TailwindFilesPattern = /\.(tsx|jsx|html)$/
      const defaultInputCss = `@import "tailwindcss"`
      let twCompiler: Awaited<ReturnType<typeof Tailwind.compile>>
      let build: string | null = null

      const collectedClassNames = new Set<string>()

      builder.onStart(async () => {
        twCompiler = await Tailwind.compile(defaultInputCss, {
          base: process.cwd(),
          onDependency: () => {},
        })
      })

      /**
       * Extract class names from the source code.
       */
      builder.onLoad({
        filter: TailwindFilesPattern,
      }, async (args) => {
        const contents = await Bun.file(args.path).text()
        const classNames = extractClassNames(contents)

        classNames.forEach((className) => collectedClassNames.add(className))

        return undefined
      })

      builder.onResolve({
        filter: /^tailwindcss$/,
      }, (args) => {
        return {
          path: `${args.resolveDir}/${args.path}`,
        }
      })

      builder.onLoad({
        filter: /tailwindcss$/,
      }, async (args) => {
        await args.defer()

        build = twCompiler.build([...collectedClassNames])

        return {
          contents: build!,
          // TODO: maybe css?
          loader: "css",
        }
      })
    },
  }
}

function extractClassNames(source: string): string[] {
  const classNames = new Set<string>()

  // Match class attributes
  const classRegex = /class=["']([^"']+)["']/g
  let match
  while ((match = classRegex.exec(source)) !== null) {
    const classes = match[1].split(/\s+/)
    classes.forEach((className) => classNames.add(className))
  }

  // Match classList objects
  const classListRegex = /classList=\{\s*\{([^}]+)\}\s*\}/g
  while ((match = classListRegex.exec(source)) !== null) {
    const classListContent = match[1]
    const objectKeysRegex = /(\w+):/g
    let keyMatch
    while ((keyMatch = objectKeysRegex.exec(classListContent)) !== null) {
      classNames.add(keyMatch[1])
    }
  }

  return Array.fromIterable(classNames)
}
