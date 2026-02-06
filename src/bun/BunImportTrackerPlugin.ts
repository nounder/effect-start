import { type BunPlugin, type Import } from "bun"
import * as NPath from "node:path"

export type ImportMap = ReadonlyMap<string, Array<Import>>

/**
 * Tracks all imported modules.
 * State can be accessed via 'virtual:import-tracker' module within a bundle
 * or through `state` property returned by this function.
 */
export const make = (
  opts: {
    includeNodeModules?: false
    baseDir?: string
  } = {},
): BunPlugin & {
  state: ImportMap
} => {
  const foundImports: Map<string, Array<Import>> = new Map()
  const baseDir = opts.baseDir ?? process.cwd()

  return {
    name: "import tracker",
    setup(build) {
      const transpiler = new Bun.Transpiler({
        loader: "tsx",
      })

      // Each module that goes through this onLoad callback
      // will record its imports in `trackedImports`
      build.onLoad(
        {
          filter: /\.(ts|js)x?$/,
        },
        async (args) => {
          if (!opts.includeNodeModules && args.path.includes("/node_modules/")) {
            return undefined
          }

          const contents = await Bun.file(args.path).arrayBuffer()
          try {
            const fileImport = transpiler.scanImports(contents)
            const resolvedImports = fileImport.map((imp) => {
              const absoluteImportPath = NPath.resolve(
                NPath.dirname(args.path),
                // 'file' is a default namespace, trim it
                imp.path.replace(/^file:/, ""),
              )

              return {
                ...imp,
                // keep all module identifiers with namespace intact
                path: /(\w+):/.test(imp.path)
                  ? imp.path
                  : NPath.relative(baseDir, absoluteImportPath),
              }
            })
            foundImports.set(NPath.relative(baseDir, args.path), resolvedImports)
          } catch (e) {}

          return undefined
        },
      )

      build.onResolve(
        {
          filter: /^virtual:import-tracker$/,
        },
        () => {
          return {
            namespace: "effect-start",
            path: "virtual:import-tracker",
          }
        },
      )

      build.onLoad(
        {
          filter: /^virtual:import-tracker$/,
          namespace: "effect-start",
        },
        async (args) => {
          // Wait for all files to be loaded, ensuring
          // that every file goes through the above `onLoad()` function
          // and their imports tracked
          await args.defer()

          // Emit JSON containing the stats of each import
          return {
            contents: JSON.stringify(Object.fromEntries(foundImports.entries())),
            loader: "json",
          }
        },
      )
    },

    state: foundImports,
  }
}
