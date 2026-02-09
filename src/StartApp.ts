import * as Context from "effect/Context"
import * as Deferred from "effect/Deferred"
import type * as BunServer from "./bun/BunServer.ts"

export namespace StartApp {
  export interface Service {
    readonly server: Deferred.Deferred<BunServer.BunServer>
  }
}

export class StartApp extends Context.Tag("effect-start/StartApp")<StartApp, StartApp.Service>() {}
