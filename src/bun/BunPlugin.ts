import type * as Bun from "bun"
import type * as Plugin from "../bundler/Plugin.ts"

/**
 * Adapts a bundler-agnostic {@link Plugin.Plugin} to a {@link Bun.BunPlugin}.
 *
 * Bun's `onResolve`/`onLoad` builder is already shaped like the generic
 * plugin interface (including a native `defer()`), so this is a thin
 * pass-through rather than a behavioral shim.
 */
export function toBunPlugin(
  plugin: Plugin.Plugin,
  opts?: { readonly target?: Bun.BunPlugin["target"] },
): Bun.BunPlugin {
  return {
    name: plugin.name,
    target: opts?.target,
    setup(builder) {
      return plugin.setup({
        onResolve(options, callback) {
          builder.onResolve(options, (args) => callback(args) as any)
        },
        onLoad(options, callback) {
          builder.onLoad(options, (args) => callback(args) as any)
        },
      })
    },
  }
}
