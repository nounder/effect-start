import * as test from "bun:test"
import * as Unique from "./Unique.ts"

type RandomValuesInput = Parameters<typeof crypto.getRandomValues>[0]

const withRandomValues = <T>(values: Uint8Array, run: () => T): T => {
  const original = crypto.getRandomValues
  let offset = 0

  crypto.getRandomValues = (buffer: RandomValuesInput) => {
    const view = new Uint8Array(
      buffer!.buffer,
      buffer!.byteOffset,
      buffer!.byteLength,
    )
    const end = Math.min(offset + view.length, values.length)
    view.set(values.subarray(offset, end))

    if (end - offset < view.length) {
      view.fill(0, end - offset)
    }

    offset = end
    return buffer
  }

  try {
    return run()
  } finally {
    crypto.getRandomValues = original
  }
}

const withNow = <T>(timestamp: number, run: () => T): T => {
  const original = Date.now
  Date.now = () => timestamp

  try {
    return run()
  } finally {
    Date.now = original
  }
}

test.describe("Unique.formatUuid", () => {
  test.it("encodes bytes into canonical UUID format", () => {
    test
      .expect(
        Unique.formatUuid(
          new Uint8Array([
            0x00,
            0x01,
            0x02,
            0x03,
            0x04,
            0x05,
            0x06,
            0x07,
            0x08,
            0x09,
            0x0a,
            0x0b,
            0x0c,
            0x0d,
            0x0e,
            0x0f,
          ]),
        ),
      )
      .toBe("00010203-0405-0607-0809-0a0b0c0d0e0f")
  })
})

test.describe("Unique.uuid4", () => {
  test.it("returns a canonical UUIDv4 string", () => {
    test
      .expect(
        withRandomValues(
          new Uint8Array([
            0x00,
            0x01,
            0x02,
            0x03,
            0x04,
            0x05,
            0x06,
            0x07,
            0x08,
            0x09,
            0x0a,
            0x0b,
            0x0c,
            0x0d,
            0x0e,
            0x0f,
          ]),
          () => Unique.uuid4(),
        ),
      )
      .toBe("00010203-0405-4607-8809-0a0b0c0d0e0f")
  })
})

test.describe("Unique.uuid7", () => {
  test.it("returns a canonical UUIDv7 string", () => {
    test
      .expect(
        withNow(
          0,
          () =>
            withRandomValues(
              new Uint8Array([
                0x12,
                0x34,
                0x56,
                0x78,
                0x9a,
                0xbc,
                0xde,
                0xf0,
                0x11,
                0x22,
              ]),
              () => Unique.uuid7(),
            ),
        ),
      )
      .toBe("00000000-0000-7234-9678-9abcdef01122")
  })
})

test.describe("Unique.ulid", () => {
  test.it("returns a base32 ULID with a timestamp prefix", () => {
    test
      .expect(
        withRandomValues(
          new Uint8Array([
            0x06,
            0x07,
            0x08,
            0x09,
            0x0a,
            0x0b,
            0x0c,
            0x0d,
            0x0e,
            0x0f,
          ]),
          () => Unique.ulid(0x000102030405),
        ),
      )
      .toBe("00041061050R3GG28A1C60T3GF")
  })

  test.it("does not mix random bits into the timestamp prefix", () => {
    const time = 0x000102030405
    const ulidA = withRandomValues(
      new Uint8Array([
        0x00,
        0x00,
        0x00,
        0x00,
        0x00,
        0x00,
        0x00,
        0x00,
        0x00,
        0x00,
      ]),
      () => Unique.ulid(time),
    )
    const ulidB = withRandomValues(
      new Uint8Array([
        0xe0,
        0x00,
        0x00,
        0x00,
        0x00,
        0x00,
        0x00,
        0x00,
        0x00,
        0x00,
      ]),
      () => Unique.ulid(time),
    )

    test
      .expect(ulidA.slice(0, 10))
      .toBe(ulidB.slice(0, 10))
  })
})

test.describe("Unique.toTimestamp", () => {
  test.it("decodes a 48-bit timestamp from bytes", () => {
    const bytes = new Uint8Array([
      0x00,
      0x01,
      0x02,
      0x03,
      0x04,
      0x05,
      0x06,
      0x07,
      0x08,
      0x09,
      0x0a,
      0x0b,
      0x0c,
      0x0d,
      0x0e,
      0x0f,
    ])

    test
      .expect(Unique.toTimestamp(bytes))
      .toBe(0x000102030405)
  })
})

test.describe("Unique.token", () => {
  test.it("returns a base32 token with the requested length", () => {
    test
      .expect(
        withRandomValues(
          new Uint8Array([0x00, 0x01, 0x02, 0x03]),
          () => Unique.token(4),
        ),
      )
      .toBe("0123")

    test
      .expect(
        withRandomValues(new Uint8Array(128), () => Unique.token()),
      )
      .toBe("0".repeat(32))
  })
})
