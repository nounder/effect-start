import type { BunPlugin, Loader } from "bun"

type VirtualFiles = Record<string, string>

function loaderFromPath(path: string): Loader {
  return path.slice(path.lastIndexOf(".") + 1) as Loader
}

export function make(files: VirtualFiles): BunPlugin {
  return {
    name: "virtual-fs",
    setup(build) {
      build.onResolve(
        {
          // change the filter so it only works for file namespace
          filter: /.*/,
        },
        (args) => {
          const resolved = resolvePath(args.path, args.resolveDir)
          const resolvedFile = files[resolved]

          if (resolvedFile) {
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

          if (!contents) {
            return undefined
          }

          return {
            contents,
            loader: loaderFromPath(args.path),
          }
        },
      )
    },
  }
}

function resolvePath(path: string, base = process.cwd()) {
  return Bun.resolveSync(path, base)
}
