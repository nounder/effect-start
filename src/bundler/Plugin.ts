/**
 * Bundler-agnostic plugin shape, modeled after esbuild's `onResolve`/`onLoad`
 * plugin interface. Bun, esbuild, and (via a thin adapter) Rolldown can all
 * run a plugin written against these types.
 *
 * A plugin built with this module has no bundler-specific dependency. To run
 * it, convert it with the adapter for the target bundler:
 * - `bun/BunPlugin.ts` -> `Bun.build({ plugins: [...] })`
 * - `esbuild/EsbuildPlugin.ts` -> `esbuild.build({ plugins: [...] })`
 * - `rolldown/RolldownPlugin.ts` -> `rolldown.build({ plugins: [...] })`
 */

export type Loader =
  | "js"
  | "jsx"
  | "ts"
  | "tsx"
  | "css"
  | "json"
  | "text"
  | "base64"
  | "dataurl"
  | "file"
  | "binary"
  | "copy"
  | "empty"
  | "object"

export interface OnResolveOptions {
  readonly filter: RegExp
  readonly namespace?: string
}

export interface OnLoadOptions {
  readonly filter: RegExp
  readonly namespace?: string
}

export interface OnResolveArgs {
  readonly path: string
  readonly importer: string
  readonly namespace: string
  readonly resolveDir: string
  readonly kind: string
  readonly pluginData?: unknown
}

export interface OnResolveResult {
  path?: string
  namespace?: string
  external?: boolean
  pluginData?: unknown
}

export interface OnLoadArgs {
  readonly path: string
  readonly namespace: string
  readonly pluginData?: unknown
  /**
   * Defer this callback until every module reachable at the current point in
   * the build has resolved and loaded, then resume. Native on Bun; emulated
   * on adapters (esbuild, Rolldown) by tracking in-flight `onLoad` calls, so
   * it approximates "wait for currently-discoverable siblings" rather than
   * Bun's exact "wait for the whole parse pass" guarantee.
   */
  readonly defer: () => Promise<void>
}

export interface OnLoadResult {
  contents?: string | Uint8Array
  loader?: Loader
  resolveDir?: string
  pluginData?: unknown
}

export type OnResolveCallback = (
  args: OnResolveArgs,
) => OnResolveResult | undefined | null | Promise<OnResolveResult | undefined | null>

export type OnLoadCallback = (
  args: OnLoadArgs,
) => OnLoadResult | undefined | Promise<OnLoadResult | undefined>

export interface PluginBuild {
  onResolve(options: OnResolveOptions, callback: OnResolveCallback): void
  onLoad(options: OnLoadOptions, callback: OnLoadCallback): void
}

export interface Plugin {
  readonly name: string
  readonly setup: (build: PluginBuild) => void | Promise<void>
}
