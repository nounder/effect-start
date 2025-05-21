import { BunHttpServer } from "@effect/platform-bun"

type BunServeFuntionOptions = Parameters<typeof Bun.serve<Record<string, any>>>[0]

export const layer = (opts: BunServeFuntionOptions) => {
  return BunHttpServer.layer({})
}

Bun.serve(opts)
