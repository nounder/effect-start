import * as Effect from "effect/Effect"
import * as Function from "effect/Function"
import * as Layer from "effect/Layer"
import * as BunRuntime from "./bun/BunRuntime.ts"
import * as BunServer from "./bun/BunServer.ts"
import * as NodeFileSystem from "./node/FileSystem.ts"

export function layer<
  Layers extends [
    Layer.Layer<never, any, any>,
    ...Array<Layer.Layer<never, any, any>>,
  ],
>(...layers: Layers): Layer.Layer<
  { [k in keyof Layers]: Layer.Layer.Success<Layers[k]> }[number],
  { [k in keyof Layers]: Layer.Layer.Error<Layers[k]> }[number],
  { [k in keyof Layers]: Layer.Layer.Context<Layers[k]> }[number]
> {
  return Layer.mergeAll(...layers)
}

export function serve<ROut, E>(
  load: () => Promise<{
    default: Layer.Layer<
      ROut,
      E,
      BunServer.BunServer
    >
  }>,
) {
  const appLayer = Function.pipe(
    Effect.tryPromise(load),
    Effect.map(v => v.default),
    Effect.orDie,
    Layer.unwrapEffect,
  )

  return Function.pipe(
    BunServer.layer(),
    BunServer.withLogAddress,
    Layer.provide(NodeFileSystem.layer),
    Layer.provide(appLayer),
    Layer.provide(BunServer.layer()),
    Layer.launch,
    BunRuntime.runMain,
  )
}
