import {
  HttpApp,
  HttpMiddleware,
  HttpRouter,
  HttpServerResponse,
} from "@effect/platform"
import { Effect } from "effect"
import { RandomComponent } from "./ui.tsx"

console.log(
  RandomComponent({ enabled: true }),
)

const router = HttpRouter.empty.pipe(
  HttpRouter.get(
    "/",
    Effect.sync(() => {
      const r = RandomComponent({})

      return HttpServerResponse.html(r.outerHTML)
    }),
  ),
  HttpRouter.use(HttpMiddleware.logger),
)

Deno.serve(
  HttpApp.toWebHandler(router),
)
