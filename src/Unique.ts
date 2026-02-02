export function uuid(): string {
  return base36(uuid4bytes())
}

export function uuidSorted(): string {
  return base36(uuid7bytes())
}

export function token(length: number): string {
  return base36(bytes(length))
}

function base36(bytes: Uint8Array): string {
  if (bytes.length === 0) return ""
  let zeros = 0
  while (zeros < bytes.length && bytes[zeros] === 0) zeros++

  let n = 0n
  for (let i = zeros; i < bytes.length; i++) n = (n << 8n) + BigInt(bytes[i])

  return "0".repeat(zeros) + (n === 0n ? "" : n.toString(36))
}

export function bytes(length: number): Uint8Array {
  const buf = new Uint8Array(length)
  crypto.getRandomValues(buf)
  return buf
}

export function uuid4bytes(): Uint8Array {
  const buf = bytes(16)
  buf[6] = (buf[6] & 0x0f) | 0x40 // version 4
  buf[8] = (buf[8] & 0x3f) | 0x80 // variant

  return buf
}

function uuid7bytes(): Uint8Array {
  const buf = new Uint8Array(16)
  const timestamp = BigInt(Date.now())

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
