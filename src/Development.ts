import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as FileSystem from "effect/FileSystem"
import * as Function from "effect/Function"
import * as Layer from "effect/Layer"
import * as Option from "effect/Option"
import type * as PlatformError from "effect/PlatformError"
import * as PubSub from "effect/PubSub"
import * as Stream from "effect/Stream"
import * as BunChildProcessSpawner from "./bun/BunChildProcessSpawner.ts"
import * as BunFileSystem from "./bun/BunFileSystem.ts"
import * as BunPath from "./bun/BunPath.ts"

export type DevelopmentEvent =
  | FileSystem.WatchEvent
  | {
    readonly _tag: "Reload"
  }

const devStateKey = Symbol.for("effect-start/Development")
const globals = globalThis as typeof globalThis & {
  [devStateKey]?: {
    count: number
    pubsub: PubSub.PubSub<DevelopmentEvent> | null
  }
}
const devState = globals[devStateKey] ??= { count: 0, pubsub: null }

export const _testResetState = () => {
  devState.count = 0
  devState.pubsub = null
}

export class Development extends Context.Service<
  Development,
  {
    events: PubSub.PubSub<DevelopmentEvent>
  }
>()("effect-start/Development") {}

// Matches source files and directory paths (which fire withou ext when its created/renamed)
const SOURCE_FILENAME = /(?:\.(?:tsx?|jsx?|html?|css|json)|(?:^|\/)[^./]+)$/

const filterSourceFiles = (event: FileSystem.WatchEvent): boolean => {
  return SOURCE_FILENAME.test(event.path)
}

const watchSource = (opts?: {
  path?: string
  recursive?: boolean
  filter?: (event: FileSystem.WatchEvent) => boolean
}): Stream.Stream<
  FileSystem.WatchEvent,
  PlatformError.PlatformError,
  FileSystem.FileSystem
> => {
  const baseDir = opts?.path ?? process.cwd()
  const customFilter = opts?.filter

  return Function.pipe(
    Stream.unwrap(
      Effect.map(
        FileSystem.FileSystem,
        (fs) => fs.watch(baseDir, { recursive: opts?.recursive ?? true }),
      ),
    ),
    customFilter ? Stream.filter(customFilter) : Function.identity,
    Stream.rechunk(1),
    Stream.throttle({
      units: 1,
      cost: () => 1,
      duration: "400 millis",
      strategy: "enforce",
    }),
  )
}

const watch = (opts?: {
  path?: string
  recursive?: boolean
  filter?: (event: FileSystem.WatchEvent) => boolean
}) =>
  Effect.gen(function*() {
    devState.count++

    if (devState.count === 1) {
      const pubsub = yield* PubSub.unbounded<DevelopmentEvent>()
      devState.pubsub = pubsub
      const scope = yield* Effect.scope

      yield* Function.pipe(
        watchSource({
          path: opts?.path,
          recursive: opts?.recursive,
          filter: opts?.filter ?? filterSourceFiles,
        }),
        Stream.runForEach((event) => PubSub.publish(pubsub, event)),
        Effect.forkIn(scope, { startImmediately: true }),
      )
    } else {
      yield* PubSub.publish(devState.pubsub!, { _tag: "Reload" })
    }

    return Development.of({ events: devState.pubsub! })
  })

export const layer = (opts?: {
  path?: string
  recursive?: boolean
  filter?: (event: FileSystem.WatchEvent) => boolean
}) => Layer.effect(Development, watch(opts))

export const layerTest = Layer.effect(
  Development,
  Effect.map(PubSub.unbounded<DevelopmentEvent>(), (events) => ({ events })),
)

export const option = Effect.serviceOption(Development)

export const events: Stream.Stream<DevelopmentEvent> = Stream.unwrap(
  Function.pipe(
    option,
    Effect.map(
      Option.match({
        onNone: () => Stream.empty,
        onSome: (dev) => Stream.fromPubSub(dev.events),
      }),
    ),
  ),
)

export function layerBase() {
  return BunChildProcessSpawner.layer.pipe(
    Layer.provideMerge(Layer.merge(
      BunFileSystem.layer,
      BunPath.layer,
    )),
  )
}
