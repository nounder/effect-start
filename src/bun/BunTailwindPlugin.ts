import * as Tailwind from "@tailwindcss/node"
import type {
  BunPlugin,
} from "bun"
import {
  Array,
} from "effect"

export const make = (opts: {
  importer?: () => Promise<typeof Tailwind>
  filesPattern?: RegExp
} = {}): BunPlugin => {
  const {
    filesPattern = /\.(tsx|jsx|html|svelte|vue|astro)$/,
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
      const defaultInputCss = `@import "tailwindcss";`
      let twCompiler: Awaited<ReturnType<typeof Tailwind.compile>>
      let build: string | null = null

      const collectedClassNames = new Set<string>()

      builder.onStart(async () => {
        twCompiler = await Tailwind.compile(defaultInputCss, {
          base: process.cwd(),
          onDependency: (path) => {},
        })
      })

      /**
       * Extract class names from the source code.
       */
      builder.onLoad({
        filter: filesPattern,
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
        filter: /^tailwindcss$/,
      }, async (args) => {
        await args.defer()

        build = twCompiler.build([
          ...collectedClassNames,
        ])

        return {
          contents: build!,
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

  // Match React className attributes
  const classNameRegex = /className=["']([^"']+)["']/g
  while ((match = classNameRegex.exec(source)) !== null) {
    const classes = match[1].split(/\s+/)
    classes.forEach((className) => classNames.add(className))
  }

  // Match className with template literals and expressions
  const classNameExpressionRegex =
    /className=\{[^}]*["'`]([a-zA-Z0-9\s\-_:]+)["'`][^}]*\}/g
  while ((match = classNameExpressionRegex.exec(source)) !== null) {
    const classes = match[1].split(/\s+/).filter(className =>
      /^[a-zA-Z0-9\-_:]+$/.test(className) && className.length > 0
    )
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
