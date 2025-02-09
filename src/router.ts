import { HttpRouter, HttpServerResponse } from "@effect/platform"
import LiveReloadHttpRoute from "./LiveReloadHttpRoute.ts"
import { FrontendRoute } from "./solid.ts"
import { TailwidCssRoute } from "./tailwind.ts"

export default HttpRouter.empty.pipe(
  HttpRouter.get("/yo", HttpServerResponse.text("yo")),
  HttpRouter.get("/.bundle/events", LiveReloadHttpRoute),
  HttpRouter.get("/.bundle/app.css", TailwidCssRoute),
  HttpRouter.all("*", FrontendRoute),
)
