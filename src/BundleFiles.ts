import { FileSystem } from "@effect/platform"
import {
  Array,
  Effect,
  Iterable,
  pipe,
  Record,
  Schema as S,
} from "effect"
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
      inputs: context.inputs,
      outputs: context.outputs,
    }

    const normalizedOutDir = outDir.replace(/\/$/, "")

    const bundleArtifacts = pipe(
      manifest.outputs,
      Array.map((output) => [output.output, context.getArtifact(output.output)!] as const),
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
    const outputPaths = Array.map(manifest.outputs, (o) => o.output)
    const artifactBlobs = yield* pipe(
      outputPaths,
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
          type: manifest.outputs[i].type,
        })
      )),
    )
    const artifactsRecord = pipe(
      Iterable.zip(
        outputPaths,
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
        const entry = manifest.inputs.find((e) => e.input === url)

        return entry?.output ?? null
      },
      getArtifact: (path: string) => {
        return artifactsRecord[path] ?? null
      },
    }

    return bundleContext
  })
}
