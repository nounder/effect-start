import * as Context from "effect/Context"
import * as Layer from "effect/Layer"
import * as Reactivity from "effect/reactivity/Reactivity"
import type * as SqlClient from "effect/sql/SqlClient"
import * as SqliteClient from "../../bun/SqliteClient.ts"

export class StudioSql extends Context.Service<StudioSql, SqlClient.SqlClient>()(
  "effect-start/Studio/StudioSql",
) {}

export function layer() {
  return Layer
    .effect(StudioSql, SqliteClient.make({ filename: ":memory:" }))
    .pipe(Layer.provide(Reactivity.layer))
}
