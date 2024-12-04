import { Context, Effect, Layer } from "effect"
import type { ViteDevServer } from "vite"

export class Vite extends Context.Tag("Vite")<Vite, ViteDevServer>() {}

export const ViteDev = Layer.effect(
  Vite,
  Effect.tryPromise(createViteServer).pipe(
    // Make sure server is closed
    Effect.tap((server) =>
      Effect.addFinalizer(() =>
        Effect.promise(async () => {
          await server.waitForRequestsIdle()
          await server.close()
        })
      )
    ),
  ),
)

async function createViteServer() {
  if (globalThis.__vite__) return globalThis.__vite__ as ViteDevServer
  const { createServer } = await import("vite")
  const { default: solidPlugin } = await import("vite-plugin-solid")
  const { default: denoPlugin } = await import("@deno/vite-plugin")

  const server = await createServer({
    root: Deno.cwd(),
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

  globalThis.__vite__ = server

  return server
}
