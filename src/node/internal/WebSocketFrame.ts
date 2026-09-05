/**
 * Minimal server-side RFC 6455 framing: enough to accept a client
 * connection, decode incoming (masked) frames, and encode outgoing
 * (unmasked) frames. No extensions (e.g. compression) are supported.
 */
import * as NCrypto from "node:crypto"

export const OPCODE_CONTINUATION = 0x0
export const OPCODE_TEXT = 0x1
export const OPCODE_BINARY = 0x2
export const OPCODE_CLOSE = 0x8
export const OPCODE_PING = 0x9
export const OPCODE_PONG = 0xa

export type Opcode =
  | typeof OPCODE_CONTINUATION
  | typeof OPCODE_TEXT
  | typeof OPCODE_BINARY
  | typeof OPCODE_CLOSE
  | typeof OPCODE_PING
  | typeof OPCODE_PONG

export interface Frame {
  readonly opcode: Opcode
  readonly payload: Buffer
}

const HANDSHAKE_GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11"

export function acceptKeyFor(key: string): string {
  return NCrypto.createHash("sha1").update(key + HANDSHAKE_GUID).digest("base64")
}

export function encodeFrame(opcode: Opcode, payload: Uint8Array): Buffer {
  const length = payload.length
  let headerLength = 2
  if (length >= 65536) headerLength += 8
  else if (length >= 126) headerLength += 2

  const buffer = Buffer.allocUnsafe(headerLength + length)
  buffer[0] = 0x80 | opcode // FIN=1, no fragmentation on send
  if (length < 126) {
    buffer[1] = length
  } else if (length < 65536) {
    buffer[1] = 126
    buffer.writeUInt16BE(length, 2)
  } else {
    buffer[1] = 127
    buffer.writeUInt32BE(Math.floor(length / 2 ** 32), 2)
    buffer.writeUInt32BE(length % 2 ** 32, 6)
  }
  Buffer.from(payload).copy(buffer, headerLength)
  return buffer
}

export function encodeText(text: string): Buffer {
  return encodeFrame(OPCODE_TEXT, Buffer.from(text, "utf-8"))
}

export function encodeBinary(data: Uint8Array): Buffer {
  return encodeFrame(OPCODE_BINARY, data)
}

export function encodeClose(code: number, reason?: string): Buffer {
  const reasonBytes = reason ? Buffer.from(reason, "utf-8") : Buffer.alloc(0)
  const payload = Buffer.allocUnsafe(2 + reasonBytes.length)
  payload.writeUInt16BE(code, 0)
  reasonBytes.copy(payload, 2)
  return encodeFrame(OPCODE_CLOSE, payload)
}

export function decodeClosePayload(payload: Buffer): { code: number; reason?: string } {
  if (payload.length < 2) return { code: 1005 }
  const code = payload.readUInt16BE(0)
  const reason = payload.length > 2 ? payload.subarray(2).toString("utf-8") : undefined
  return { code, reason }
}

/**
 * Incrementally decodes a byte stream into complete WebSocket messages,
 * reassembling fragmented (continuation) frames and unmasking client frames.
 * Control frames (close/ping/pong) are never fragmented per RFC 6455, so they
 * pass straight through.
 */
export class FrameDecoder {
  private buffer = Buffer.alloc(0)
  private fragments: Array<Buffer> = []
  private fragmentOpcode: Opcode | undefined

  push(chunk: Uint8Array): Array<Frame> {
    this.buffer = this.buffer.length === 0 ? Buffer.from(chunk) : Buffer.concat([this.buffer, chunk])

    const messages: Array<Frame> = []
    while (true) {
      const parsed = this.readRawFrame()
      if (!parsed) break
      const { fin, opcode, payload } = parsed

      if (opcode === OPCODE_CONTINUATION) {
        this.fragments.push(payload)
        if (fin) {
          messages.push({
            opcode: this.fragmentOpcode ?? OPCODE_BINARY,
            payload: Buffer.concat(this.fragments),
          })
          this.fragments = []
          this.fragmentOpcode = undefined
        }
        continue
      }

      if (!fin && (opcode === OPCODE_TEXT || opcode === OPCODE_BINARY)) {
        this.fragmentOpcode = opcode
        this.fragments.push(payload)
        continue
      }

      messages.push({ opcode, payload })
    }
    return messages
  }

  private readRawFrame(): { fin: boolean; opcode: Opcode; payload: Buffer } | null {
    const buf = this.buffer
    if (buf.length < 2) return null

    const fin = (buf[0] & 0x80) !== 0
    const opcode = (buf[0] & 0x0f) as Opcode
    const masked = (buf[1] & 0x80) !== 0
    let payloadLength: number = buf[1] & 0x7f
    let offset = 2

    if (payloadLength === 126) {
      if (buf.length < offset + 2) return null
      payloadLength = buf.readUInt16BE(offset)
      offset += 2
    } else if (payloadLength === 127) {
      if (buf.length < offset + 8) return null
      const high = buf.readUInt32BE(offset)
      const low = buf.readUInt32BE(offset + 4)
      payloadLength = high * 2 ** 32 + low
      offset += 8
    }

    let maskKey: Buffer | undefined
    if (masked) {
      if (buf.length < offset + 4) return null
      maskKey = buf.subarray(offset, offset + 4)
      offset += 4
    }

    if (buf.length < offset + payloadLength) return null

    const rawPayload = buf.subarray(offset, offset + payloadLength)
    const payload = maskKey ? unmask(rawPayload, maskKey) : Buffer.from(rawPayload)

    this.buffer = buf.subarray(offset + payloadLength)

    return { fin, opcode, payload }
  }
}

function unmask(payload: Buffer, maskKey: Buffer): Buffer {
  const result = Buffer.allocUnsafe(payload.length)
  for (let i = 0; i < payload.length; i++) {
    result[i] = payload[i] ^ maskKey[i % 4]
  }
  return result
}
