import * as NPath from "node:path"
import type * as rolldown from "rolldown"
import * as DeferredLoad from "../bundler/internal/DeferredLoad.ts"
import type * as Plugin from "../bundler/Plugin.ts"

/**
 * Adapts a bundler-agnostic {@link Plugin.Plugin} to a Rollup-shaped
 * {@link rolldown.Plugin}. Rolldown has no `onResolve`/`onLoad` — this maps
 * onto its `resolveId`/`load` hooks and, like the esbuild adapter, synthesizes
 * `defer()` via {@link DeferredLoad}.
 */
export function toRolldownPlugin(plugin: Plugin.Plugin): rolldown.Plugin {
  const tracker = DeferredLoad.makeDeferredLoadTracker()
  const resolveHandlers: Array<{ options: Plugin.OnResolveOptions; callback: Plugin.OnResolveCallback }> = []
  const loadHandlers: Array<{ options: Plugin.OnLoadOptions; callback: Plugin.OnLoadCallback }> = []

  plugin.setup({
    onResolve(options, callback) {
      resolveHandlers.push({ options, callback })
    },
    onLoad(options, callback) {
      loadHandlers.push({ options, callback })
    },
  })

  return {
    name: plugin.name,
    async resolveId(source, importer, extraOptions) {
      for (const { options, callback } of resolveHandlers) {
        if (options.namespace !== undefined) continue
        if (!options.filter.test(source)) continue

        const result = await callback({
          path: source,
          importer: importer ?? "",
          namespace: "file",
          resolveDir: importer ? NPath.dirname(importer) : process.cwd(),
          kind: extraOptions.kind,
        })
        if (result?.path === undefined) continue

        return { id: result.path, external: result.external }
      }
      return null
    },
    async load(id) {
      for (const { options, callback } of loadHandlers) {
        if (options.namespace !== undefined) continue
        if (!options.filter.test(id)) continue

        const result = await tracker.wrapLoad(() =>
          Promise.resolve(
            callback({
              path: id,
              namespace: "file",
              defer: tracker.defer,
            }),
          )
        )
        if (result === undefined) continue

        const contents = typeof result.contents === "string"
          ? result.contents
          : new TextDecoder().decode(result.contents)

        // Rolldown dropped native CSS bundling (see
        // https://github.com/rolldown/rolldown/issues/4271), so a "css"
        // result can't be returned as a module's code. Emit it as an asset
        // instead and let the importing module resolve to an empty stub.
        if (result.loader === "css") {
          this.emitFile({
            type: "asset",
            name: NPath.basename(id),
            originalFileName: id,
            source: contents,
          })
          return { code: "", moduleType: "empty" }
        }

        return {
          code: contents,
          moduleType: result.loader,
        }
      }
      return null
    },
  }
}
