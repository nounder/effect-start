import * as SqliteClient from "../../bun/SqliteClient.ts"
import * as GlobalLayer from "../../GlobalLayer.ts"

export const layer = SqliteClient
  .layer({ filename: ":memory:" })
  .pipe(GlobalLayer.globalLayer("effect-start/Studio/sql"))
