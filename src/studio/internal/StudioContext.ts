import * as Context from "effect/Context"
import type * as StudioStore from "../StudioStore.ts"

export type AuthOptions = {
  readonly type: "basic"
  readonly username: string
  readonly password: string
}

export class Studio extends Context.Service<Studio, {
  readonly path: string
  readonly auth: AuthOptions | undefined
  readonly store: StudioStore.State
}>()("effect-start/Studio") {}
