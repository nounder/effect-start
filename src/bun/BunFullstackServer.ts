import {
  BunHttpServer,
} from "@effect/platform-bun"
import {
  Config,
  Effect,
  Fiber,
  Layer,
  Option,
} from "effect"
import * as httpServer from "./BunFullstackServer_httpServer.ts"

// As of Bun v1.2.13, these types are not publicy exported.
type BunServeFuntionOptions = Parameters<
  typeof Bun.serve<any, {}>
>[0]

type DefaultOptions = Parameters<typeof BunHttpServer.make>[0]

type Options =
  & DefaultOptions
  & Omit<BunServeFuntionOptions, "fetch" | "error">

export const make = (opts: Options) => {
  return Effect.gen(function*() {
    const env = yield* Config.string("NODE_ENV").pipe(Config.option)

    return httpServer.make({
      development: Option.getOrNull(env) === "development",
      ...opts,
    })
  })
}

export const layer = (opts: Options) => {
  return Layer.unwrapEffect(
    Effect.gen(function*() {
      const env = yield* Config.string("NODE_ENV").pipe(Config.option)
      const development = Option.getOrNull(env) !== "development"

      return httpServer.layer({
        development,
        ...opts,
      })
    }),
  )
}
