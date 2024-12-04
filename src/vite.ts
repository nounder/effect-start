import { Context, Effect, Layer } from "effect"
import type { ViteDevServer } from "vite"

let vite: ViteDevServer | undefined

export class Vite extends Context.Tag("Vite")<Vite, ViteDevServer>() {}

export const ViteDev = Layer.effect(
  Vite,
  Effect.tryPromise(async () => {
    const { createServer } = await import("vite")
    const { default: solidPlugin } = await import("vite-plugin-solid")
    const { default: denoPlugin } = await import("@deno/vite-plugin")

    console.log("creating server")

    const server = await createServer({
      root: import.meta.dirname,
      plugins: [
        // @ts-ignore it works
        solidPlugin(),
        // @ts-ignore it works
        denoPlugin(),
      ],
      server: {
        middlewareMode: true,
      },
    })

    vite = server

    return server
  }),
)
