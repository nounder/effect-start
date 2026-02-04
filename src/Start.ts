import * as Effect from "effect/Effect"
import * as Function from "effect/Function"
import * as Layer from "effect/Layer"
import * as BunHttpServer from "./bun/BunHttpServer.ts"
import * as BunRuntime from "./bun/BunRuntime.ts"
import * as StartApp from "./StartApp.ts"

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
      BunHttpServer.BunHttpServer
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
    BunHttpServer.layerAuto(),
    Layer.provide(appLayer),
    Layer.provide([
      BunHttpServer.layer(),
      StartApp.layer(),
    ]),
    Layer.launch,
    BunRuntime.runMain,
  )
}
