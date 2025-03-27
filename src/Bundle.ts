import { FileSystem, HttpRouter, HttpServerResponse } from "@effect/platform"
import {
  Array,
  Context,
  Data,
  Effect,
  Match,
  Option,
  pipe,
  Record,
} from "effect"
import { importJsBlob } from "./esm.ts"

export class BundleError extends Data.TaggedError("BundleError")<{
  message: string
  cause?: unknown
}> {}

export type BundleManifest = {
  entrypoints: {
    [path: string]: string
  }
  artifacts: {
    [path: string]: {
      type: string
      size: number
      hash: string | null
      imports?: Array<any>
    }
  }
}

export type BundleContext =
  & BundleManifest
  & {
    resolve: (url: string) => string
    getArtifact: (path: string) => Blob | null
  }

export const Tag = <T extends string>(name: T) => <Identifier>() =>
  Context.Tag(
    `effect-bundler/Bundle/tags/${name}`,
  )<Identifier, BundleContext>()

export const load = <M>(
  context: BundleContext,
): Effect.Effect<M, BundleError> => {
  const [[artifact]] = Object.values(context.entrypoints)

  return Effect.tryPromise({
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
}

export const toHttpRouter = <T>(
  bundle: Context.Tag<T, BundleContext>,
) => {
  return Effect.map(
    bundle,
    v =>
      Record.reduce(
        v.artifacts,
        HttpRouter.empty,
        (router, artifact, path) =>
          router.pipe(
            HttpRouter.get(
              `/${path}`,
              HttpServerResponse.text("yo"),
            ),
          ),
      ),
  )
}

export const toFiles = <T>(
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
              catch: e =>
                new BundleError({
                  message: "Failed to read an artifact as a buffer",
                  cause: e,
                }),
            }),
            Effect.andThen(b =>
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
