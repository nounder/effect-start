import { HttpApp } from "@effect/platform"
import { Console, Effect, pipe, Ref, Stream, SubscriptionRef } from "effect"
import * as NodeFS from "node:fs/promises"
import * as NodePath from "node:path"
import * as NodeUrl from "node:url"

const SOURCE_FILENAME = /.*\.(tsx?|jsx?)$/

async function bundleHttpApp<M extends { default: any }>(
  module: string,
): Promise<HttpApp.Default> {
  const packageJson = await import("../../package.json", {
    with: { type: "json" },
  })
  const external = Object.keys(packageJson.dependencies)
    .filter(v => v !== "solid-js" && v !== "@solidjs/router")
    .flatMap(v => [
      v,
      v + "/*",
    ])

  const output = await Bun.build({
    entrypoints: [module],
    target: "bun",
    conditions: ["solid"],
    sourcemap: "inline",
    packages: "bundle",
    external: [
      ...external,
    ],
    plugins: [
      await import("bun-plugin-solid").then((v) =>
        v.SolidPlugin({
          generate: "ssr",
          hydratable: false,
        })
      ),
    ],
  })

  const [artifact] = output.outputs
  const contents = await artifact.arrayBuffer()
  const hash = Bun.hash(contents)
  const path = "/tmp/effect-bundle-" + hash.toString(16) + ".js"
  const file = Bun.file(path)
  await file.write(contents)

  const bundleModule = await import(path)

  await file.delete()

  return bundleModule.default
}

export const build = <M extends { default: any }>(module: string) =>
  Effect.gen(function*() {
    const modulePath = NodeUrl.fileURLToPath(module)
    const baseDir = NodePath.dirname(modulePath)
    const bundleEffect = Effect.tryPromise({
      try: () => bundleHttpApp(modulePath),
      catch: (err) => {
        console.trace()
        throw err
      },
    })

    const ref = yield* SubscriptionRef.make<HttpApp.Default>(
      yield* bundleEffect,
    )

    const fileChanges = pipe(
      Stream.fromAsyncIterable(
        NodeFS.watch(baseDir, { recursive: true }),
        e => e,
      ),
      Stream.filter(event => SOURCE_FILENAME.test(event.filename!)),
      Stream.tap(Console.log),
    )

    pipe(
      fileChanges,
      Stream.throttle({
        units: 1,
        cost: () => 1,
        duration: "100 millis",
        strategy: "enforce",
      }),
      Stream.runForEach(() =>
        bundleEffect.pipe(Effect.flatMap(app => Ref.update(ref, () => app)))
      ),
    )

    return yield* ref
  })
