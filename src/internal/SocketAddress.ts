/*
 * Adapted from effect-smol aka v4 (unstable/socket/SocketServer.ts)
 *
 * The bound address of a socket server, either a TCP host and port or a Unix
 * socket path. A server's actual address can differ from the requested listen
 * options after binding — for example when listening on port `0` — so consumers
 * read the resolved address from the server rather than the options.
 */

// WorkerAddress covers serverless runtimes (e.g. Cloudflare Workers) that
// never bind a real socket: the platform's edge routes requests to the
// isolate before a handler runs, so hostname/port are synthetic rather than
// something the server itself resolved.
export type Address = TcpAddress | UnixAddress | WorkerAddress

export interface TcpAddress {
  readonly _tag: "TcpAddress"
  readonly hostname: string
  readonly port: number
}

export interface UnixAddress {
  readonly _tag: "UnixAddress"
  readonly path: string
}

export interface WorkerAddress {
  readonly _tag: "WorkerAddress"
  readonly hostname: string
  readonly port: number
}

export const tcp = (hostname: string, port: number): TcpAddress => ({
  _tag: "TcpAddress",
  hostname,
  port,
})

export const unix = (path: string): UnixAddress => ({
  _tag: "UnixAddress",
  path,
})

export const worker = (hostname = "workers.dev", port = 443): WorkerAddress => ({
  _tag: "WorkerAddress",
  hostname,
  port,
})

// UnixAddress has no hostname/port of its own, so callers that need a single
// identity across every Address variant get a local-loopback fallback.
export const hostname = (address: Address): string => address._tag === "UnixAddress" ? "localhost" : address.hostname

export const port = (address: Address): number => address._tag === "UnixAddress" ? 0 : address.port

export const defaultScheme = (address: Address): string => address._tag === "WorkerAddress" ? "https" : "http"

// A wildcard bind isn't reachable at that literal hostname from a browser, so
// rewrite it to localhost for display purposes only (the resolved address
// itself is left untouched).
export const urlOf = (address: Address, scheme: string = defaultScheme(address)): string => {
  if (address._tag === "UnixAddress") return `${scheme}://localhost`
  const host = address.hostname === "0.0.0.0" || address.hostname === "::" ? "localhost" : address.hostname
  return `${scheme}://${host}:${address.port}`
}
