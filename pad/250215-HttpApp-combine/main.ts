import {
  HttpApp,
  HttpRouter,
  HttpServerRequest,
  HttpServerResponse,
} from "@effect/platform"
import { BunRuntime } from "@effect/platform-bun"
import { makeRunMain } from "@effect/platform/Runtime"
import { Console, Effect, pipe } from "effect"
import * as OurHttpApp from "../../src/effect/HttpAppExtra.ts"

const router0 = HttpRouter.empty.pipe(
  HttpRouter.get("/", HttpServerResponse.text("Router 0")),
)

const router1 = HttpRouter.empty.pipe(
  HttpRouter.get("/", HttpServerResponse.text("Router 1")),
  HttpRouter.get("/yo", HttpServerResponse.text("Router 1")),
)

const router2 = HttpRouter.empty.pipe() // HttpRouter.get("*", HttpServerResponse.text("Router 2")),

// const router = OurHttpApp.combine(router0, router1, router2)
const router = pipe(
  router0,
  HttpRouter.mount("/", router1),
  HttpRouter.mount("/", router2),
)

console.log(
  await HttpApp.toWebHandler(router)(new Request("https://google.com/yodsad")),
)

BunRuntime.runMain(
  router.pipe(
    Effect.provideService(
      HttpServerRequest.HttpServerRequest,
      HttpServerRequest.fromWeb(new Request("https://google.com/yodsad")),
    ),
    Effect.andThen(pipe((res) => Console.log("Res", res))),
  ),
)
