/*
 * Adapted from effect-smol aka v4 (unstable/socket/SocketServer.ts)
 *
 * The bound address of a socket server, either a TCP host and port or a Unix
 * socket path. A server's actual address can differ from the requested listen
 * options after binding — for example when listening on port `0` — so consumers
 * read the resolved address from the server rather than the options.
 */

export type Address = TcpAddress | UnixAddress

export interface TcpAddress {
  readonly _tag: "TcpAddress"
  readonly hostname: string
  readonly port: number
}

export interface UnixAddress {
  readonly _tag: "UnixAddress"
  readonly path: string
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
