import * as FileSystem from "./FileSystem.ts"
import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Function from "effect/Function"
import * as GlobalValue from "effect/GlobalValue"
import * as Layer from "effect/Layer"
import * as Option from "effect/Option"
import * as PubSub from "effect/PubSub"
import * as Stream from "effect/Stream"
import type * as PlatformError from "./PlatformError.ts"

export type DevelopmentEvent =
  | FileSystem.WatchEvent
  | {
      readonly _tag: "Reload"
    }

const devState = GlobalValue.globalValue(Symbol.for("effect-start/Development"), () => ({
  count: 0,
  pubsub: null as PubSub.PubSub<DevelopmentEvent> | null,
}))

/** @internal */
export const _resetForTesting = () => {
  devState.count = 0
  devState.pubsub = null
}

export type DevelopmentService = {
  events: PubSub.PubSub<DevelopmentEvent>
}

export class Development extends Context.Tag("effect-start/Development")<
  Development,
  DevelopmentService
>() {}

const SOURCE_FILENAME = /\.(tsx?|jsx?|html?|css|json)$/

export const filterSourceFiles = (event: FileSystem.WatchEvent): boolean => {
  return SOURCE_FILENAME.test(event.path)
}

export const filterDirectory = (event: FileSystem.WatchEvent): boolean => {
  return event.path.endsWith("/")
}

export const watchSource = (opts?: {
  path?: string
  recursive?: boolean
  filter?: (event: FileSystem.WatchEvent) => boolean
}): Stream.Stream<FileSystem.WatchEvent, PlatformError.PlatformError, FileSystem.FileSystem> => {
  const baseDir = opts?.path ?? process.cwd()
  const customFilter = opts?.filter

  return Function.pipe(
    Stream.unwrap(
      Effect.map(FileSystem.FileSystem, (fs) =>
        fs.watch(baseDir, { recursive: opts?.recursive ?? true }),
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

export const watch = (opts?: {
  path?: string
  recursive?: boolean
  filter?: (event: FileSystem.WatchEvent) => boolean
}) =>
  Effect.gen(function* () {
    devState.count++

    if (devState.count === 1) {
      const pubsub = yield* PubSub.unbounded<DevelopmentEvent>()
      devState.pubsub = pubsub

      yield* Function.pipe(
        watchSource({
          path: opts?.path,
          recursive: opts?.recursive,
          filter: opts?.filter ?? filterSourceFiles,
        }),
        Stream.runForEach((event) => PubSub.publish(pubsub, event)),
        Effect.fork,
      )
    } else {
      yield* PubSub.publish(devState.pubsub!, { _tag: "Reload" })
    }

    return { events: devState.pubsub! } satisfies DevelopmentService
  })

export const layerWatch = (opts?: {
  path?: string
  recursive?: boolean
  filter?: (event: FileSystem.WatchEvent) => boolean
}) => Layer.scoped(Development, watch(opts))

export const stream = (): Stream.Stream<DevelopmentEvent> =>
  Stream.unwrap(
    Function.pipe(
      Effect.serviceOption(Development),
      Effect.map(
        Option.match({
          onNone: () => Stream.empty,
          onSome: (dev) => Stream.fromPubSub(dev.events),
        }),
      ),
    ),
  )
