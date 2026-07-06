import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Supervisor from "effect/Supervisor"
import * as StudioSupervisor from "./internal/StudioSupervisor.ts"
import * as Studio from "./Studio.ts"

export const layer: Layer.Layer<never, never, Studio.Studio> = Layer
  .unwrapEffect(
    Effect.gen(function*() {
      const studio = yield* Studio.Studio
      return Supervisor.addSupervisor(
        new StudioSupervisor.StudioSupervisor(studio.store),
      )
    }),
  )
