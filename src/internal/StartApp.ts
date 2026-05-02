import * as Context from "effect/Context"
import type * as Deferred from "effect/Deferred"
import type * as BunServer from "../bun/BunServer.ts"

export class StartApp extends Context.Tag("effect-start/StartApp")<
  StartApp,
  {
    server: Deferred.Deferred<BunServer.BunServer>
  }
>() {}
