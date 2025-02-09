import { FileSystem, HttpApp } from "@effect/platform"
import {
  Effect,
  pipe,
  Ref,
  Stream,
  SubscriptionRef,
  SynchronizedRef,
} from "effect"
import * as NodeFS from "node:fs/promises"
import * as NodePath from "node:path"
import * as NodeUrl from "node:url"
import { watchNodeWithOptions } from "../effect/node.ts"

const SOURCE_FILENAME = /.*\.(tsx?|jsx?)$/

async function bundleHttpApp<M extends { default: any }>(
  module: string,
): Promise<HttpApp.Default> {
  const output = await Bun.build({
    entrypoints: [module],
    target: "bun",
    conditions: ["solid"],
  })

  const [artifact] = output.outputs

  const hash = Bun.hash(await artifact.text())
  const path = "/tmp/effect-bundle-" + hash.toString(16) + ".js"
  const file = Bun.file(path)

  const bundleModule = await import(path)

  await file.delete()

  return bundleModule.default
}

export const build = <M extends { default: any }>(module: string) =>
  Effect.gen(function*() {
    const modulePath = NodeUrl.fileURLToPath(module)
    const baseDir = NodePath.dirname(modulePath)
    const bundle = Effect.tryPromise(() => bundleHttpApp(modulePath))

    const ref = yield* SubscriptionRef.make<HttpApp.Default>(
      yield* bundle,
    )

    const fileChanges = pipe(
      Stream.fromAsyncIterable(
        NodeFS.watch(baseDir, { recursive: true }),
        e => e,
      ),
      Stream.filter(event => SOURCE_FILENAME.test(event.filename!)),
    )

    // should probably fork that?
    pipe(
      fileChanges,
      Stream.throttle({
        units: 1,
        cost: () => 1,
        duration: "100 millis",
        strategy: "enforce",
      }),
      Stream.runForEach(() =>
        bundle.pipe(Effect.flatMap(app => Ref.update(ref, () => app)))
      ),
    )

    return yield* ref
  })
