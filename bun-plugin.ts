import { plugin } from "bun"
import { transformAsync } from "@babel/core"
import solidPreset from "babel-preset-solid"
import ts from "@babel/preset-typescript"
import { type BunPlugin } from "bun"

export function solidPlugin(options): BunPlugin {
  return {
    name: "bun-plugin-solid",
    setup: (build) => {
      build.onLoad({ filter: /\.(js|ts)x$/ }, async (args) => {
        const { readFile } = await import("node:fs/promises")
        const code = await readFile(args.path, "utf8")
        const transforms = await transformAsync(code, {
          filename: args.path,
          presets: [
            [solidPreset, options],
            [ts, {}],
          ],
        })

        return {
          contents: transforms!.code!,
          loader: "js",
        }
      })
    },
  }
}

plugin(
  solidPlugin(
    {
      moduleName: "./dom-renderer.tsx",
      generate: "universal",
    },
  ),
)
