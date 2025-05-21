import { BunHttpServer } from "@effect/platform-bun"

// Bun.serve has multiple signatures. Target params when routes option is passed AI!
type BunServeFuntionOptions = Parameters<typeof Bun.serve>[0]

export const layer = (opts: BunServeFuntionOptions) => {
  return BunHttpServer.layer({})
}

Bun.serve(opts)
