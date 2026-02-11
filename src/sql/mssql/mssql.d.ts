// types from @types/mssql@9.1.9
declare module "mssql" {
  export interface config {
    readonly server: string
    readonly database?: string
    readonly user?: string
    readonly password?: string
    readonly port?: number
    readonly pool?: {
      readonly max?: number
      readonly min?: number
      readonly idleTimeoutMillis?: number
    }
    readonly options?: {
      readonly encrypt?: boolean
      readonly trustServerCertificate?: boolean
      readonly requestTimeout?: number
      readonly connectionTimeout?: number
      readonly connectTimeout?: number
    }
  }

  export class ConnectionPool {
    constructor(config: config)
    connect(): Promise<ConnectionPool>
    close(): Promise<void>
    request(): Request
    transaction(): Transaction
  }

  export class Request {
    input(name: string, value: unknown): Request
    query<T>(query: string): Promise<{ recordset?: ReadonlyArray<T> }>
  }

  export class Transaction {
    begin(): Promise<void>
    commit(): Promise<void>
    rollback(): Promise<void>
    request(): Request
  }
}
