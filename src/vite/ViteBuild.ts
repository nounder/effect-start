import Layer from "effect/Layer"
import Effect from "effect/Effect"
import { Vite } from "./Vite.ts"

interface ViteManifest {
  [key: string]: {
    file: string
    name: string
    src: string
    isEntry: boolean
  }
}

export const make = (opts: {
  outDir?: string
}) =>
  Layer.scoped(
    Vite,
    Effect.gen(function* () {
      const outDir = opts.outDir ?? "dist"
      const viteManifestPath = ".vite/manifest.json"

      const viteManifest: ViteManifest = yield* Effect.tryPromise(() =>
        Deno.readTextFile(`${outDir}/${viteManifestPath}`)
          .then(JSON.parse)
      )

      const fetch = async (req: Request) => {
        const url = new URL(req.url)

        using file = await Deno.open(outDir + url.pathname, {
          read: true,
        })
        const stat = await file.stat()

        return new Response(file.readable, {
          headers: {
            "content-length": stat.size.toString(),
            // "cache-control": "public, max-age=31536000",
          },
        })
      }

      return {
        fetch,
      }
    }),
  )
