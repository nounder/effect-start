import {
  FileSystem,
  Headers,
  HttpApp,
  HttpRouter,
  HttpServerRequest,
  HttpServerResponse,
} from "@effect/platform"
import { RouteNotFound } from "@effect/platform/HttpServerError"
import {
  Array,
  Context,
  Data,
  Effect,
  Iterable,
  pipe,
  PubSub,
  Record,
  Schema as S,
  Scope,
  Stream,
} from "effect"
import * as NPath from "node:path"
import { fileURLToPath } from "node:url"
import { importJsBlob } from "./esm.ts"
import * as SseHttpResponse from "./SseHttpResponse.ts"

export const BundleEntrypointRouteTypeId: unique symbol = Symbol.for(
  "effect-bundler/BundleEntrypointRouteTypeId",
)

export const BundleOutputRouteTypeId: unique symbol = Symbol.for(
  "effect-bundler/BundleOutputRouteTypeId",
)

/**
 * Generic shape describing a bundle across multiple bundlers
 * (like bun, esbuild & vite)
 */
export const BundleManifestSchema = S.Struct({
  entrypoints: S.Record({
    key: S.String,
    value: S.String,
  }),
  artifacts: S.Record({
    key: S.String,
    value: S.Struct({
      type: S.String,
      size: S.Number,
      hash: S.Union(S.Null, S.String)
        .pipe(S.optional),
    }),
  }),
})

export type BundleManifest = typeof BundleManifestSchema.Type

export type BundleEvent = { type: "Change"; path: string }

export type BundleKey = `${string}Bundle`

/**
 * Passed to bundle effects and within bundle runtime.
 * Used to expose artifacts via HTTP server and properly resolve
 * imports within the bundle.
 */
export type BundleContext =
  & BundleManifest
  & {
    // TODO: consider removing resolve: way of resolving URL should be
    // the same regardless of underlying bundler since we have access
    // to all artifacts already.
    resolve: (url: string) => string
    getArtifact: (path: string) => Blob | null
    events?: PubSub.PubSub<BundleEvent>
  }

export class BundleError extends Data.TaggedError("BundleError")<{
  message: string
  cause?: unknown
}> {}

/**
 * Creates a tag that symbolicly identifies a bundle.
 *
 * Useful when you want to provide a bundle at the start of the script.
 */
export const Tag = <T extends string>(name: T) => <Identifier>() =>
  Context.Tag(
    `effect-bundler/tags/${name}`,
  )<Identifier, BundleContext>()

export const tagged = <I extends BundleKey>(
  key: I,
) => {
  return Context.GenericTag<I, BundleContext>(key)
}

/**
 * Lodas a bundle as a javascript module.
 * Bundle must have only one entrypoint.
 */
export const load = <M>(
  context: BundleContext,
): Effect.Effect<M, BundleError> =>
  Effect.gen(function*() {
    const [artifact, ...rest] = Object.values(context.entrypoints)

    if (rest.length > 0) {
      return yield* Effect.fail(
        new BundleError({
          message: "Multiple entrypoints are not supported in load()",
        }),
      )
    }

    return yield* Effect.tryPromise({
      try: () => {
        const blob = context.getArtifact(artifact)

        return importJsBlob<M>(blob!)
      },
      catch: (e) =>
        new BundleError({
          message: "Failed to load entrypoint",
          cause: e,
        }),
    })
  })

export const toHttpApp = <T extends BundleKey>(
  bundleTag: Context.Tag<T, BundleContext>,
): Effect.Effect<
  HttpServerResponse.HttpServerResponse,
  RouteNotFound,
  HttpServerRequest.HttpServerRequest | Scope.Scope | T
> =>
  Effect.gen(function*() {
    const request = yield* HttpServerRequest.HttpServerRequest
    const bundle = yield* bundleTag
    const path = request.url.substring(1)

    /**
     * Expose manifest that contains information about the bundle.
     */
    if (path === "manifest.json") {
      return HttpServerResponse.text(
        JSON.stringify(
          {
            entrypoints: bundle.entrypoints,
            artifacts: bundle.artifacts,
          },
          undefined,
          2,
        ),
        {
          headers: {
            "Content-Type": "application/json",
          },
        },
      )
    }

    /**
     * Expose events endpoint if available.
     * Useful for development to implement live reload.
     */
    if (bundle.events && path === "events") {
      return yield* SseHttpResponse.make<BundleEvent>(
        Stream.fromPubSub(bundle.events),
      )
    }

    const artifact = bundle.artifacts[path]

    /**
     * Expose artifacts.
     */
    if (artifact) {
      const artifactBlob = bundle.getArtifact(path)!

      return yield* renderBlob(artifactBlob)
    }

    return yield* Effect.fail(
      new RouteNotFound({
        request,
      }),
    )
  })

/**
 * Exports a bundle to a file system under specified directory.
 */
export const toFiles = (
  context: BundleContext,
  outDir: string,
) => {
  return Effect.gen(function*() {
    const fs = yield* FileSystem.FileSystem
    const manifest: BundleManifest = {
      entrypoints: context.entrypoints,
      artifacts: context.artifacts,
    }

    const normalizedOutDir = outDir.replace(/\/$/, "")

    const bundleArtifacts = pipe(
      manifest.artifacts,
      Record.mapEntries((_, k) => [k, context.getArtifact(k)!]),
    )
    const extraArtifacts = {
      "manifest.json": new Blob([JSON.stringify(manifest, undefined, 2)], {
        type: "application/json",
      }),
    }

    const allArtifacts = {
      ...bundleArtifacts,
      ...extraArtifacts,
    }

    const existingOutDirFiles = yield* fs.readDirectory(normalizedOutDir).pipe(
      Effect.catchAll(() => Effect.succeed(null)),
    )

    // check if the output directory is empty. if it contains previous build,
    // remove it. Otherwise fail.
    if (existingOutDirFiles && existingOutDirFiles.length > 0) {
      if (existingOutDirFiles.includes("manifest.json")) {
        yield* Effect.logWarning(
          "Output directory seems to contain previous build. Overwriting...",
        )

        yield* fs.remove(normalizedOutDir, {
          recursive: true,
        })
      } else {
        yield* Effect.fail(
          new BundleError({
            message: "Output directory is not empty",
          }),
        )
      }
    }

    yield* fs.makeDirectory(normalizedOutDir, {
      recursive: true,
    })

    // write all artifacts to files
    yield* Effect.all(
      pipe(
        allArtifacts,
        Record.toEntries,
        Array.map(([p, b]) =>
          pipe(
            Effect.tryPromise({
              try: () => b.arrayBuffer(),
              catch: (e) =>
                new BundleError({
                  message: "Failed to read an artifact as a buffer",
                  cause: e,
                }),
            }),
            Effect.andThen((b) =>
              fs.writeFile(
                `${normalizedOutDir}/${p}`,
                new Uint8Array(b),
              )
            ),
          )
        ),
      ),
      { concurrency: 16 },
    )
  })
}

/**
 * Loads a bundle from a directory and returns a BundleContext.
 * Expects the directory to contain a manifest.json file and all the artifacts
 * referenced in the manifest.
 */
export const fromFiles = (
  directory: string,
): Effect.Effect<
  BundleContext,
  BundleError,
  FileSystem.FileSystem
> => {
  return Effect.gen(function*() {
    const fs = yield* FileSystem.FileSystem
    const normalizedDir = directory.replace(/\/$/, "")
    const manifest = yield* pipe(
      fs.readFileString(`${normalizedDir}/manifest.json`),
      Effect.andThen((v) => JSON.parse(v) as unknown),
      Effect.andThen(S.decodeUnknownSync(BundleManifestSchema)),
      Effect.catchAll((e) =>
        Effect.fail(
          new BundleError({
            message: `Failed to read manifest.json from ${normalizedDir}`,
            cause: e,
          }),
        )
      ),
    )
    const artifactsPairs = Record.toEntries(manifest.artifacts)
    const artifactBlobs = yield* pipe(
      artifactsPairs,
      Iterable.map(([k]) => fs.readFile(`${normalizedDir}/${k}`)),
      Effect.all,
      Effect.catchAll((e) =>
        new BundleError({
          message: `Failed to read an artifact from ${normalizedDir}`,
          cause: e,
        })
      ),
      Effect.andThen(Iterable.map((v, i) =>
        new Blob([v], {
          type: artifactsPairs[i][0],
        })
      )),
    )
    const artifactsRecord = pipe(
      Iterable.zip(
        Iterable.map(artifactsPairs, (v) => v[0]),
        artifactBlobs,
      ),
      Record.fromEntries,
    )

    const bundleContext: BundleContext = {
      ...manifest,
      // TODO: support fullpath file:// urls
      // this will require having an access to base path of a build
      // and maybe problematic because bundlers transform urls on build
      resolve: (url: string) => {
        return manifest.entrypoints[url] ?? null
      },
      getArtifact: (path: string) => {
        return artifactsRecord[path] ?? null
      },
    }

    return bundleContext
  })
}

/**
 * Render HTML to a string.
 * Useful for SSR.
 */
export const renderPromise = <I extends BundleKey>(
  clientBundle: Context.Tag<I, BundleContext>,
  render: (
    request: Request,
    resolve: (url: string) => string,
  ) => Promise<Response>,
): HttpApp.Default<BundleError | RouteNotFound, I> => {
  return Effect.gen(function*() {
    const bundle = yield* clientBundle
    const req = yield* HttpServerRequest.HttpServerRequest
    const fetchReq = req.source as Request

    // TODO: add support for file:// urls
    // this will require handling source base path
    const resolve = (url: string): string => {
      const path = url.startsWith("file://")
        ? fileURLToPath(url)
        : url
      const publicBase = "/.bundle"
      const publicPath = bundle.resolve(path)

      return NPath.join(publicBase, publicPath ?? path)
    }

    const output = yield* Effect.tryPromise({
      try: () =>
        render(
          fetchReq,
          resolve,
        ),
      catch: (e) =>
        new BundleError({
          message: "Failed to render",
          cause: e,
        }),
    })

    return yield* HttpServerResponse.raw(output.body, {
      status: output.status,
      statusText: output.statusText,
      headers: Headers.fromInput(output.headers as any),
    })
  })
}

type BundleEntrypointHttpApp<E = never, R = never> =
  & HttpApp.Default<E, R>
  & {
    readonly [BundleEntrypointRouteTypeId]: typeof BundleEntrypointRouteTypeId
  }

type BundleOutputRouteHttpApp<E = never, R = never> =
  & HttpApp.Default<E, R>
  & {
    readonly [BundleOutputRouteTypeId]: typeof BundleOutputRouteTypeId
  }

export function httpEntrypoint(
  uri: string,
): BundleEntrypointHttpApp<never, "BrowserBundle">
export function httpEntrypoint<K extends BundleKey>(
  uri: string,
  bundleKey: K,
): BundleEntrypointHttpApp<never, K>
export function httpEntrypoint<
  K extends BundleKey = "BrowserBundle",
>(
  uri: string,
  bundleKey: K = "BrowserBundle" as K,
): BundleEntrypointHttpApp<never, K> {
  return Object.assign(
    Effect.gen(function*() {
      const request = yield* HttpServerRequest.HttpServerRequest
      const bundle = yield* tagged(bundleKey)
      const entrypointPath = uri.startsWith("file://")
        ? fileURLToPath(uri)
        : uri
      const requestPath = request.url.substring(1)

      return HttpServerResponse.text("httpEntrypoint")
    }),
    {
      [BundleEntrypointRouteTypeId]: BundleEntrypointRouteTypeId,
    } as any,
  )
}

export function httpBundle(): BundleOutputRouteHttpApp<never, "BrowserBundle">
export function httpBundle<T extends BundleKey>(
  bundleTag?: Context.Tag<T, BundleContext>,
): BundleOutputRouteHttpApp<never, T> {
  return Object.assign(
    toHttpApp(bundleTag ?? tagged("BrowserBundle" as T)),
    {
      [BundleOutputRouteTypeId]: BundleOutputRouteTypeId,
    } as any,
  )
}

const renderBlob = (blob: Blob) =>
  Effect.gen(function*() {
    const bytes = yield* Effect.promise(() => blob.arrayBuffer())
      .pipe(
        Effect.andThen(v => new Uint8Array(v)),
      )

    return HttpServerResponse.uint8Array(bytes, {
      headers: {
        "Content-Type": blob.type,
        "Content-Length": String(blob.size),
      },
    })
  })
