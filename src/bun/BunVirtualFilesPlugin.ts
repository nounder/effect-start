import type { BunPlugin, Loader } from "bun"

type VirtualFiles = Record<string, string>

function getLoaderForFile(path: string): Loader {
  return path.slice(path.lastIndexOf(".") + 1) as Loader
}

export function make(files: VirtualFiles): BunPlugin {
  return {
    name: "virtual-fs",
    setup(build) {
      build.onResolve(
        {
          filter: /.*/,
          namespace: "virtual-fs",
        },
        (args) => {
          if (args.namespace === "virtual-fs" || args.namespace === undefined) {
            return {
              path: args.path,
              namespace: "virtual-fs",
            }
          }
          const resolved = resolvePath(args.path, args.resolveDir)
          if (resolved in files) {
            return {
              path: resolved,
              namespace: "virtual-fs",
            }
          }
          return
        },
      )

      build.onLoad(
        {
          filter: /.*/,
          namespace: "virtual-fs",
        },
        (args) => {
          const contents = files[args.path]
          if (contents === undefined) return
          return { contents, loader: getLoaderForFile(args.path) }
        },
      )
    },
  }
}

function resolvePath(path: string, base = process.cwd()) {
  return Bun.resolveSync(path, base)
}
