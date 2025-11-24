import { Start } from "effect-start"
import { BunHttpServer } from "effect-start/bun"

export default Start.layer(
  Start.router({
    load: () => import("./routes"),
    path: import.meta.resolve("./routes"),
  }),
  BunHttpServer.layer({
    port: 3010,
    routes: {
      "/data": Response.json({
        message: "hello /data",
      }),
    },
  }),
)

if (import.meta.main) {
  Start.serve(() => import(import.meta.url))
}
