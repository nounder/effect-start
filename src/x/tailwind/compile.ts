import fsPromises from "node:fs/promises"
import path from "node:path"
import { pathToFileURL } from "node:url"
import { compile as _compile, compileAst as _compileAst, Features, Polyfills } from "tailwindcss"
import * as BunEnhancedResolve from "../../bun/_BunEnhancedResolve"

type AstNode = Parameters<typeof _compileAst>[0][number]

export { Features, Polyfills }

export type Resolver = (id: string, base: string) => Promise<string | false | undefined>

export interface CompileOptions {
  base: string
  from?: string
  onDependency: (path: string) => void
  polyfills?: Polyfills

  customCssResolver?: Resolver
  customJsResolver?: Resolver
}

function createCompileOptions({
  base,
  from,
  polyfills,
  onDependency,

  customCssResolver,
  customJsResolver,
}: CompileOptions) {
  return {
    base,
    polyfills,
    from,
    async loadModule(id: string, base: string) {
      return loadModule(id, base, onDependency, customJsResolver)
    },
    async loadStylesheet(id: string, sheetBase: string) {
      let sheet = await loadStylesheet(id, sheetBase, onDependency, customCssResolver)

      return sheet
    },
  }
}

async function ensureSourceDetectionRootExists(compiler: {
  root: Awaited<ReturnType<typeof compile>>["root"]
}) {
  // Verify if the `source(…)` path exists (until the glob pattern starts)
  if (compiler.root && compiler.root !== "none") {
    let globSymbols = /[*{]/
    let basePath: Array<string> = []
    for (let segment of compiler.root.pattern.split("/")) {
      if (globSymbols.test(segment)) {
        break
      }

      basePath.push(segment)
    }

    let exists = await fsPromises
      .stat(path.resolve(compiler.root.base, basePath.join("/")))
      .then((stat) => stat.isDirectory())
      .catch(() => false)

    if (!exists) {
      throw new Error(
        `The \`source(${compiler.root.pattern})\` does not exist or is not a directory.`,
      )
    }
  }
}

export async function compileAst(
  ast: Array<AstNode>,
  options: CompileOptions,
): ReturnType<typeof _compileAst> {
  let compiler = await _compileAst(ast, createCompileOptions(options))
  await ensureSourceDetectionRootExists(compiler)
  return compiler
}

export async function compile(css: string, options: CompileOptions): ReturnType<typeof _compile> {
  let compiler = await _compile(css, createCompileOptions(options))
  await ensureSourceDetectionRootExists(compiler)
  return compiler
}

export async function loadModule(
  id: string,
  base: string,
  _onDependency: (path: string) => void,
  customJsResolver?: Resolver,
) {
  if (id[0] !== ".") {
    let resolvedPath = await resolveJsId(id, base, customJsResolver)
    if (!resolvedPath) {
      throw new Error(`Could not resolve '${id}' from '${base}'`)
    }

    let module = await importModule(pathToFileURL(resolvedPath).href)
    return {
      path: resolvedPath,
      base: path.dirname(resolvedPath),
      module: module.default ?? module,
    }
  }

  let resolvedPath = await resolveJsId(id, base, customJsResolver)
  if (!resolvedPath) {
    throw new Error(`Could not resolve '${id}' from '${base}'`)
  }

  let module = await importModule(pathToFileURL(resolvedPath).href + "?id=" + Date.now())

  return {
    path: resolvedPath,
    base: path.dirname(resolvedPath),
    module: module.default ?? module,
  }
}

async function loadStylesheet(
  id: string,
  base: string,
  onDependency: (path: string) => void,
  cssResolver?: Resolver,
) {
  let resolvedPath = await resolveCssId(id, base, cssResolver)
  if (!resolvedPath) throw new Error(`Could not resolve '${id}' from '${base}'`)

  onDependency(resolvedPath)

  let file = await fsPromises.readFile(resolvedPath, "utf-8")
  return {
    path: resolvedPath,
    base: path.dirname(resolvedPath),
    content: file,
  }
}

async function importModule(path: string): Promise<any> {
  if (typeof globalThis.__tw_load === "function") {
    let module = await globalThis.__tw_load(path)
    if (module) {
      return module
    }
  }

  return await import(path)
}

const cssResolver = BunEnhancedResolve.ResolverFactory.createResolver({
  extensions: [".css"],
  mainFields: ["style"],
  conditionNames: ["style"],
})
async function resolveCssId(
  id: string,
  base: string,
  customCssResolver?: Resolver,
): Promise<string | false | undefined> {
  if (typeof globalThis.__tw_resolve === "function") {
    let resolved = globalThis.__tw_resolve(id, base)
    if (resolved) {
      return Promise.resolve(resolved)
    }
  }

  if (customCssResolver) {
    let customResolution = await customCssResolver(id, base)
    if (customResolution) {
      return customResolution
    }
  }

  return runResolver(cssResolver, id, base)
}

const esmResolver = BunEnhancedResolve.ResolverFactory.createResolver({
  extensions: [".js", ".json", ".node", ".ts"],
  conditionNames: ["node", "import"],
  mainFields: ["module", "main"],
})

const cjsResolver = BunEnhancedResolve.ResolverFactory.createResolver({
  extensions: [".js", ".json", ".node", ".ts"],
  conditionNames: ["node", "require"],
  mainFields: ["main"],
})

async function resolveJsId(
  id: string,
  base: string,
  customJsResolver?: Resolver,
): Promise<string | false | undefined> {
  if (typeof globalThis.__tw_resolve === "function") {
    let resolved = globalThis.__tw_resolve(id, base)
    if (resolved) {
      return Promise.resolve(resolved)
    }
  }

  if (customJsResolver) {
    let customResolution = await customJsResolver(id, base)
    if (customResolution) {
      return customResolution
    }
  }

  return runResolver(esmResolver, id, base).catch(() => runResolver(cjsResolver, id, base))
}

function runResolver(
  resolver: BunEnhancedResolve.Resolver,
  id: string,
  base: string,
): Promise<string | false | undefined> {
  return new Promise((resolve, reject) =>
    resolver.resolve({}, base, id, {}, (err, result) => {
      if (err) return reject(err)
      resolve(result)
    }),
  )
}
