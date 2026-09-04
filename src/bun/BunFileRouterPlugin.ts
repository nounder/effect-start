import type { BunPlugin, Loader } from "bun"
import * as Effect from "effect/Effect"
import * as NPath from "node:path"
import * as FileRouter from "../FileRouter.ts"
import * as FileRouterCodegen from "../FileRouterCodegen.ts"
import * as NodeFileSystem from "../node/NodeFileSystem.ts"

/**
 * Default specifier apps import to get the file router manifest at build
 * time. Prefixed with `virtual:` so it's obviously not a real file on disk.
 */
export const DEFAULT_MODULE_ID = "virtual:effect-start/file-routes"

const NAMESPACE = "effect-start-file-routes"

export type Options = {
  /** Directory to scan for `route.tsx`/`layer.tsx` files. */
  path: string
  /** Specifier apps use to import the generated manifest. */
  moduleId?: string
}

/**
 * Bun plugin that generates the file-router manifest as a virtual module
 * instead of writing a `.server.ts`/`routes.gen.ts` file to disk.
 *
 * Register it both for local development (`Bun.plugin`) and for production
 * builds (`Bun.build({ plugins: [...] })`) so `import(moduleId)` always
 * resolves, without ever creating a file agents could mistake for source
 * code and edit.
 *
 * ```ts
 * FileRouter.layer({
 *   load: () => import(BunFileRouterPlugin.DEFAULT_MODULE_ID),
 *   path: routesDir,
 * })
 * ```
 */
export function make(options: Options): BunPlugin {
  const routesPath = NPath.resolve(options.path)
  const moduleId = options.moduleId ?? DEFAULT_MODULE_ID
  // Never actually written; only used so relative imports emitted by
  // `FileRouterCodegen.generateCode` resolve against `routesPath`.
  const virtualFilePath = NPath.join(routesPath, "__file-routes.virtual.ts")
  const resolveFilter = new RegExp(`^${escapeRegExp(moduleId)}$`)

  return {
    name: "effect-start-file-router",
    setup(build) {
      build.onResolve({ filter: resolveFilter }, () => ({
        path: virtualFilePath,
        namespace: NAMESPACE,
      }))

      build.onLoad(
        { filter: /.*/, namespace: NAMESPACE },
        async (): Promise<{ contents: string; loader: Loader }> => {
          const fileRoutes = await Effect.runPromise(
            FileRouter.walkRoutesDirectory(routesPath).pipe(
              Effect.provide(NodeFileSystem.layer),
            ),
          )

          return {
            contents: FileRouterCodegen.generateCode(fileRoutes) ?? "export default {}\n",
            loader: "ts",
          }
        },
      )
    },
  }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}
