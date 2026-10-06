/**
 * Ported from effect@4.0.0-rc.112.
 */
import type * as Duration from "effect/Duration"
import type * as Effect from "effect/Effect"
import * as Function from "effect/Function"
import * as Layer from "effect/Layer"
import * as Socket from "effect/socket/Socket"

export * from "../node/NodeSocket.ts"

export const layerWebSocketConstructor: Layer.Layer<Socket.WebSocketConstructor> = Layer.succeed(
  Socket.WebSocketConstructor,
  (url, options) =>
    new (globalThis.WebSocket as {
      new(url: string, options?: Socket.WebSocketConstructorOptions): WebSocket
    })(url, options),
)

export const layerWebSocket: (
  url: string | Effect.Effect<string>,
  options?: {
    readonly openTimeout?: Duration.Input | undefined
    readonly protocols?: string | Array<string> | undefined
  } | undefined,
) => Layer.Layer<Socket.Socket> = Function.flow(
  Socket.makeWebSocket,
  Layer.effect(Socket.Socket),
  Layer.provide(layerWebSocketConstructor),
)
