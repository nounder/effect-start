import type * as esbuild from "esbuild"
import * as DeferredLoad from "../bundler/internal/DeferredLoad.ts"
import type * as Plugin from "../bundler/Plugin.ts"

/**
 * Adapts a bundler-agnostic {@link Plugin.Plugin} to an {@link esbuild.Plugin}.
 *
 * esbuild's plugin interface already matches `onResolve`/`onLoad` shape-wise,
 * but has no `defer()` — this synthesizes one via {@link DeferredLoad}.
 */
export function toEsbuildPlugin(plugin: Plugin.Plugin): esbuild.Plugin {
  const tracker = DeferredLoad.makeDeferredLoadTracker()

  return {
    name: plugin.name,
    setup(build) {
      return plugin.setup({
        onResolve(options, callback) {
          build.onResolve(options, (args) => callback(args) as any)
        },
        onLoad(options, callback) {
          build.onLoad(
            options,
            (args) =>
              tracker.wrapLoad(async () =>
                callback({
                  ...args,
                  defer: tracker.defer,
                }) as any
              ),
          )
        },
      })
    },
  }
}
