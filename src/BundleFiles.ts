import * as FileSystem from "@effect/platform/FileSystem"
import * as Array from "effect/Array"
import * as Effect from "effect/Effect"
import * as Function from "effect/Function"
import * as Iterable from "effect/Iterable"
import * as Record from "effect/Record"
import * as S from "effect/Schema"
import {
  type BundleContext,
  BundleError,
  type BundleManifest,
  BundleManifestSchema,
} from "./Bundle.ts"

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

    const bundleArtifacts = Function.pipe(
      manifest.artifacts,
      Array.map((artifact) =>
        [artifact.path, context.getArtifact(artifact.path)!] as const
      ),
      Record.fromEntries,
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
        return yield* Effect.fail(
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
      Function.pipe(
        allArtifacts,
        Record.toEntries,
        Array.map(([p, b]) =>
          Function.pipe(
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
    const manifest = yield* Function.pipe(
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
    const artifactPaths = Array.map(manifest.artifacts, (a) => a.path)
    const artifactBlobs = yield* Function.pipe(
      artifactPaths,
      Iterable.map((path) => fs.readFile(`${normalizedDir}/${path}`)),
      Effect.all,
      Effect.catchAll((e) =>
        new BundleError({
          message: `Failed to read an artifact from ${normalizedDir}`,
          cause: e,
        })
      ),
      Effect.andThen(Iterable.map((v, i) =>
        new Blob([v.slice(0)], {
          type: manifest.artifacts[i].type,
        })
      )),
    )
    const artifactsRecord = Function.pipe(
      Iterable.zip(
        artifactPaths,
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
