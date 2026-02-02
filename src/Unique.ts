export const ALPHABET_BASE32_CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"
export const ALPHABET_BASE32_RFC4648 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"
export const ALPHABET_BASE64_URL =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_"
export const ALPHABET_HEX = "0123456789abcdef"

/**
 * Generate a random string for ids, session tokens, and API keys.
 * It uses human-friendly crockford base32 encoding (5 bit of entropy per char)
 *
 * Minimal recommended length:
 * - public ids: 16 chars (~80 bits)
 * - API keys: 32 chars (~160 bits)
 * - session tokens: 32-40 chars (~160-200 bits)
 */
export function token(length = 32): string {
  if (length <= 0) return ""

  const buf = new Uint8Array(length)
  crypto.getRandomValues(buf)

  let result = ""
  for (let i = 0; i < buf.length; i++) {
    result += ALPHABET_BASE32_CROCKFORD[buf[i] & 31]
  }

  return result
}

export function bytes(length: number): Uint8Array {
  const buf = new Uint8Array(length)
  crypto.getRandomValues(buf)
  return buf
}

export const UUID_NIL = "00000000-0000-0000-0000-000000000000"

export function uuid4(): string {
  return formatUuid(uuid4bytes())
}

export function uuid7(time: number = Date.now()): string {
  return formatUuid(uuid7Bytes(time))
}

function uuid4bytes(): Uint8Array {
  const buf = bytes(16)
  buf[6] = (buf[6] & 0x0f) | 0x40 // version 4
  buf[8] = (buf[8] & 0x3f) | 0x80 // variant

  return buf
}

/**
 * Decode a 48-bit Unix timestamp (ms) from UUID7 or ULID.
 *
 * @example
 * const bytes = Unique.uuid7Bytes()
 * const timestamp = Unique.toTimestamp(bytes)
 *
 * @example
 * const bytes = Unique.ulidBytes()
 * const timestamp = Unique.toTimestamp(bytes)
 */
export function toTimestamp(bytes: Uint8Array): number {
  if (bytes.length < 6) return 0

  return (
    bytes[0] * 0x10000000000
    + bytes[1] * 0x100000000
    + bytes[2] * 0x1000000
    + bytes[3] * 0x10000
    + bytes[4] * 0x100
    + bytes[5]
  )
}

export function uuid7Bytes(time: number = Date.now()): Uint8Array {
  const buf = new Uint8Array(16)
  const timestamp = BigInt(toSafeTime(time))

  // 48-bit timestamp (6 bytes)
  buf[0] = Number((timestamp >> 40n) & 0xffn)
  buf[1] = Number((timestamp >> 32n) & 0xffn)
  buf[2] = Number((timestamp >> 24n) & 0xffn)
  buf[3] = Number((timestamp >> 16n) & 0xffn)
  buf[4] = Number((timestamp >> 8n) & 0xffn)
  buf[5] = Number(timestamp & 0xffn)

  // 12-bit random A (1.5 bytes)
  crypto.getRandomValues(buf.subarray(6, 8))
  buf[6] = (buf[6] & 0x0f) | 0x70 // version 7

  // 2-bit variant + 62-bit random B (8 bytes)
  crypto.getRandomValues(buf.subarray(8, 16))
  buf[8] = (buf[8] & 0x3f) | 0x80 // variant

  return buf
}

/**
 * Convert UUID bytes to canonical (RFC9562) representation.
 *
 * @example
 * Unique.formatUuid(new Uint8Array(16))
 */
export function formatUuid(bytes: Uint8Array): string {
  if (bytes.length === 0) return ""

  let result = ""

  for (let i = 0; i < bytes.length; i++) {
    const byte = bytes[i]
    result += ALPHABET_HEX[(byte >> 4) & 0x0f]
    result += ALPHABET_HEX[byte & 0x0f]

    if (i === 3 || i === 5 || i === 7 || i === 9) result += "-"
  }

  return result
}

export function ulid(time: number = Date.now()): string {
  const bytes = ulidBytes(time)
  return formatUlid(bytes)
}

export function ulidBytes(time: number = Date.now()): Uint8Array {
  const buf = new Uint8Array(16)
  const timestamp = BigInt(toSafeTime(time))

  buf[0] = Number((timestamp >> 40n) & 0xffn)
  buf[1] = Number((timestamp >> 32n) & 0xffn)
  buf[2] = Number((timestamp >> 24n) & 0xffn)
  buf[3] = Number((timestamp >> 16n) & 0xffn)
  buf[4] = Number((timestamp >> 8n) & 0xffn)
  buf[5] = Number(timestamp & 0xffn)

  crypto.getRandomValues(buf.subarray(6, 16))

  return buf
}

function formatUlid(bytes: Uint8Array): string {
  if (bytes.length !== 16) return ""

  const timestamp = toTimestamp(bytes)
  const timePart = encodeUlidTime(timestamp)
  const randomPart = toBase32(bytes.subarray(6, 16))

  return `${timePart}${randomPart}`
}

function encodeUlidTime(time: number): string {
  let value = BigInt(time)
  const result = new Array<string>(10)

  for (let i = 9; i >= 0; i--) {
    result[i] = ALPHABET_BASE32_CROCKFORD[Number(value & 31n)]
    value >>= 5n
  }

  return result.join("")
}

function toSafeTime(time: number): number {
  if (!Number.isFinite(time)) return 0

  return Math.max(0, Math.trunc(time))
}

/**
 * Generate a nanoid-style random string.
 *
 * FUN_FACT: Original nanoid implementation uses base64url alphabet
 * with non-standard custom order where charater form common words found
 * in source code (like use, random, strict) to make gzip/brotli more efficient.
 * It's qt lil opt from the times where web developers
 * were competing to have the smallest possible bundle size.
 */
export function nanoid(
  size = 21,
  alphabet = ALPHABET_BASE64_URL,
): string {
  if (size <= 0 || alphabet.length === 0) return ""

  const length = alphabet.length
  const mask = (2 << Math.floor(Math.log2(length - 1))) - 1
  const step = Math.ceil((1.6 * mask * size) / length)

  let id = ""
  while (id.length < size) {
    const bytes = new Uint8Array(step)
    crypto.getRandomValues(bytes)

    for (let i = 0; i < step && id.length < size; i++) {
      const index = bytes[i] & mask
      if (index < length) id += alphabet[index]
    }
  }
  return id
}

function toBase32(
  bytes: Uint8Array,
  alphabet = ALPHABET_BASE32_CROCKFORD,
): string {
  if (bytes.length === 0) return ""

  let result = ""
  let buffer = 0
  let bits = 0

  for (const byte of bytes) {
    buffer = (buffer << 8) | byte
    bits += 8

    while (bits >= 5) {
      bits -= 5
      const index = (buffer >> bits) & 31
      result += alphabet[index]
      buffer &= (1 << bits) - 1
    }
  }

  if (bits > 0) {
    const index = (buffer << (5 - bits)) & 31
    result += alphabet[index]
  }

  return result
}
