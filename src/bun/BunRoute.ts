import * as HttpServerResponse from "@effect/platform/HttpServerResponse"
import { type HTMLBundle } from "bun"
import * as Route from "../Route.ts"

const TypeId: unique symbol = Symbol.for("effect-start/BunRoute")

export type BunRoute =
  & Route.Route
  & {
    [TypeId]: typeof TypeId
    load: () => Promise<HTMLBundle>
  }

export function loadBundle(
  load: () => Promise<HTMLBundle>,
): BunRoute {
  const route = Route.make({
    method: "GET",
    media: "text/html",
    handler: HttpServerResponse.text("Empty BunRoute"),
    schemas: {},
  })

  return Object.assign(
    Object.create(route),
    {
      [TypeId]: TypeId,
      load,
    },
  )
}
