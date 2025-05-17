import { type BunPlugin, type Import } from "bun"

type ImportMap = Map<string, Import[]>

export const make = (): BunPlugin & {
  state: ImportMap
} => {
  const foundImports: ImportMap = new Map()

  return {
    name: "import tracker",
    setup(build) {
      const transpiler = new Bun.Transpiler({
        loader: "tsx",
      })

      // Each module that goes through this onLoad callback
      // will record its imports in `trackedImports`
      build.onLoad({
        filter: /\.(ts|js)x?$/,
      }, async (args) => {
        const contents = await Bun.file(args.path).arrayBuffer()
        const fileImport = transpiler.scanImports(contents)

        foundImports.set(args.path, fileImport)

        return undefined
      })

      build.onResolve({
        filter: /^virtual:import-tracker$/,
      }, () => {
        return {
          namespace: "effect-start",
          path: "virtual:import-tracker",
        }
      })

      build.onLoad({
        filter: /^virtual:import-tracker$/,
        namespace: "effect-start",
      }, async (args) => {
        // Wait for all files to be loaded, ensuring
        // that every file goes through the above `onLoad()` function
        // and their imports tracked
        await args.defer()

        // Emit JSON containing the stats of each import
        return {
          contents: JSON.stringify(foundImports),
          loader: "json",
        }
      })
    },

    state: foundImports,
  }
}
