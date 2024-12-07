import * as vite from "vite"
import { createViteDevHandler } from "./src/vite/dev.ts"

const handler = await createViteDevHandler(
  await vite.createServer({
    server: {
      middlewareMode: true,
    },
  }),
)

// Start the Deno HTTP server
Deno.serve({
  port: 8000,
}, handler)
