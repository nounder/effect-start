declare module "@libsql/client" {
  export interface Config {
    readonly url: string
    readonly authToken?: string
    readonly syncUrl?: string
    readonly syncInterval?: number
    readonly encryptionKey?: string
  }

  export interface ResultSet {
    readonly columns: ReadonlyArray<string>
    readonly rows: ReadonlyArray<ReadonlyArray<unknown>>
    readonly rowsAffected: number
    readonly lastInsertRowid?: bigint
  }

  export interface InStatement {
    readonly sql: string
    readonly args?: ReadonlyArray<unknown> | Record<string, unknown>
  }

  export interface Client {
    execute(stmt: InStatement | string): Promise<ResultSet>
    batch(
      stmts: ReadonlyArray<InStatement | string>,
      mode?: TransactionMode,
    ): Promise<ReadonlyArray<ResultSet>>
    transaction(mode?: TransactionMode): Promise<Transaction>
    close(): void
  }

  export interface Transaction {
    execute(stmt: InStatement | string): Promise<ResultSet>
    commit(): Promise<void>
    rollback(): Promise<void>
    close(): void
  }

  export type TransactionMode = "write" | "read" | "deferred"

  export function createClient(config: Config): Client
}
