import * as Context from "effect/Context"
import * as Data from "effect/Data"
import type * as Effect from "effect/Effect"
import type * as Scope from "effect/Scope"

export class SqlError extends Data.TaggedError("SqlError")<{
  readonly code: string
  readonly message: string
  readonly cause?: unknown
}> {}

export interface SqlQuery {
  <T = any>(
    strings: TemplateStringsArray,
    ...values: Array<unknown>
  ): Effect.Effect<ReadonlyArray<T>, SqlError>

  readonly unsafe: <T = any>(
    query: string,
    values?: Array<unknown>,
  ) => Effect.Effect<ReadonlyArray<T>, SqlError>

  readonly values: {
    <T extends Record<string, unknown>>(obj: T | ReadonlyArray<T>): SqlHelper<T>
    <T extends Record<string, unknown>, K extends keyof T>(
      obj: T | ReadonlyArray<T>,
      ...columns: [K, ...Array<K>]
    ): SqlHelper<Pick<T, K>>
  }
}

export interface SqlClient extends SqlQuery {
  readonly withTransaction: <A, E, R>(
    self: Effect.Effect<A, E, R>,
  ) => Effect.Effect<A, SqlError | E, R>

  readonly reserve: Effect.Effect<SqlQuery, SqlError, Scope.Scope>

  readonly close: (options?: { readonly timeout?: number }) => Effect.Effect<void, SqlError>

  readonly use: <T>(fn: (driver: any) => Promise<T> | T) => Effect.Effect<T, SqlError>
}

export interface SqlHelper<T> {
  readonly value: ReadonlyArray<T>
  readonly columns: ReadonlyArray<keyof T>
}

export const SqlClient: Context.Tag<SqlClient, SqlClient> = Context.GenericTag<SqlClient>(
  "effect-start/Sql/SqlClient",
)
