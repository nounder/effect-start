import * as test from "bun:test"
import * as Data from "effect/Data"
import * as Effect from "effect/Effect"
import * as ParseResult from "effect/ParseResult"
import * as Schema from "effect/Schema"
import * as Stream from "effect/Stream"
import * as Entity from "./Entity.ts"

test.describe(Entity.make, () => {
  test.it("creates entity with string body", () => {
    const entity = Entity.make("hello")

    test.expect(entity.body).toBe("hello")
    test.expect(entity.headers).toEqual({})
    test.expect(entity.url).toBeUndefined()
    test.expect(entity.status).toBeUndefined()
  })

  test.it("creates entity with all options", () => {
    const entity = Entity.make("hello", {
      headers: { "content-type": "text/plain" },
      url: "https://example.com",
      status: 200,
    })

    test.expect(entity.body).toBe("hello")
    test.expect(entity.headers).toEqual({ "content-type": "text/plain" })
    test.expect(entity.url).toBe("https://example.com")
    test.expect(entity.status).toBe(200)
  })

  test.it("creates entity with object body", () => {
    const data = { key: "value" }
    const entity = Entity.make(data)

    test.expect(entity.body).toBe(data)
  })

  test.it("creates entity with Uint8Array body", () => {
    const bytes = new Uint8Array([1, 2, 3])
    const entity = Entity.make(bytes)

    test.expect(entity.body).toBe(bytes)
  })

  test.it("creates entity with ArrayBuffer body", () => {
    const buffer = new ArrayBuffer(8)
    const entity = Entity.make(buffer)

    test.expect(entity.body).toBe(buffer)
  })

  test.it("creates entity with Stream body", () => {
    const stream = Stream.make(new Uint8Array([1, 2, 3]))
    const entity = Entity.make(stream)

    test.expect(entity.body).toBe(stream)
  })
})

test.describe(Entity.type, () => {
  test.it("returns content-type from headers if present", () => {
    const entity = Entity.make("hello", {
      headers: { "content-type": "application/xml" },
    })

    test.expect(Entity.type(entity)).toBe("application/xml")
  })

  test.it("infers text/plain for string body", () => {
    const entity = Entity.make("hello")

    test.expect(Entity.type(entity)).toBe("text/plain")
  })

  test.it("infers application/octet-stream for Uint8Array body", () => {
    const entity = Entity.make(new Uint8Array([1, 2, 3]))

    test.expect(Entity.type(entity)).toBe("application/octet-stream")
  })

  test.it("infers application/octet-stream for ArrayBuffer body", () => {
    const entity = Entity.make(new ArrayBuffer(8))

    test.expect(Entity.type(entity)).toBe("application/octet-stream")
  })

  test.it("infers application/json for object body", () => {
    const entity = Entity.make({ key: "value" })

    test.expect(Entity.type(entity)).toBe("application/json")
  })

  test.it("returns application/octet-stream for unknown body types", () => {
    const entity = Entity.make(null as any)

    test.expect(Entity.type(entity)).toBe("application/octet-stream")
  })
})

test.describe(Entity.length, () => {
  test.it("returns content-length from headers if present", () => {
    const entity = Entity.make("hello", {
      headers: { "content-length": "42" },
    })

    test.expect(Entity.length(entity)).toBe(42)
  })

  test.it("calculates length for string body", () => {
    const entity = Entity.make("hello")

    test.expect(Entity.length(entity)).toBe(5)
  })

  test.it("calculates length for multi-byte string", () => {
    const entity = Entity.make("héllo")

    test.expect(Entity.length(entity)).toBe(6)
  })

  test.it("returns byteLength for Uint8Array body", () => {
    const entity = Entity.make(new Uint8Array([1, 2, 3, 4, 5]))

    test.expect(Entity.length(entity)).toBe(5)
  })

  test.it("returns byteLength for ArrayBuffer body", () => {
    const entity = Entity.make(new ArrayBuffer(8))

    test.expect(Entity.length(entity)).toBe(8)
  })

  test.it("returns undefined for object body", () => {
    const entity = Entity.make({ a: 1 })

    test.expect(Entity.length(entity)).toBeUndefined()
  })
})

test.describe("text", () => {
  test.it("returns string body directly", () =>
    Effect.gen(function* () {
      const entity = Entity.make("hello world")
      const result = yield* entity.text

      test.expect(result).toBe("hello world")
    }).pipe(Effect.runPromise),
  )

  test.it("decodes Uint8Array body to string", () =>
    Effect.gen(function* () {
      const bytes = new TextEncoder().encode("hello world")
      const entity = Entity.make(bytes)
      const result = yield* entity.text

      test.expect(result).toBe("hello world")
    }).pipe(Effect.runPromise),
  )

  test.it("decodes ArrayBuffer body to string", () =>
    Effect.gen(function* () {
      const bytes = new TextEncoder().encode("hello world")
      const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
      const entity = Entity.make(buffer)
      const result = yield* entity.text

      test.expect(result).toBe("hello world")
    }).pipe(Effect.runPromise),
  )

  test.it("decodes Stream body to string", () =>
    Effect.gen(function* () {
      const bytes1 = new TextEncoder().encode("hello ")
      const bytes2 = new TextEncoder().encode("world")
      const stream = Stream.make(bytes1, bytes2)
      const entity = Entity.make(stream)
      const result = yield* entity.text

      test.expect(result).toBe("hello world")
    }).pipe(Effect.runPromise),
  )

  test.it("fails for unsupported body types", async () => {
    const entity = Entity.make(42 as any)
    const result = await Effect.runPromiseExit(entity.text)

    test.expect(result._tag).toBe("Failure")
  })
})

test.describe("json", () => {
  test.it("returns object body directly", () =>
    Effect.gen(function* () {
      const data = { key: "value", num: 42 }
      const entity = Entity.make(data)
      const result = yield* entity.json

      test.expect(result).toEqual(data)
    }).pipe(Effect.runPromise),
  )

  test.it("parses string body as JSON", () =>
    Effect.gen(function* () {
      const entity = Entity.make('{"key":"value"}')
      const result = yield* entity.json

      test.expect(result).toEqual({ key: "value" })
    }).pipe(Effect.runPromise),
  )

  test.it("parses Uint8Array body as JSON", () =>
    Effect.gen(function* () {
      const bytes = new TextEncoder().encode('{"key":"value"}')
      const entity = Entity.make(bytes)
      const result = yield* entity.json

      test.expect(result).toEqual({ key: "value" })
    }).pipe(Effect.runPromise),
  )

  test.it("parses ArrayBuffer body as JSON", () =>
    Effect.gen(function* () {
      const bytes = new TextEncoder().encode('{"key":"value"}')
      const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
      const entity = Entity.make(buffer)
      const result = yield* entity.json

      test.expect(result).toEqual({ key: "value" })
    }).pipe(Effect.runPromise),
  )

  test.it("parses Stream body as JSON", () =>
    Effect.gen(function* () {
      const bytes = new TextEncoder().encode('{"key":"value"}')
      const stream = Stream.make(bytes)
      const entity = Entity.make(stream)
      const result = yield* entity.json

      test.expect(result).toEqual({ key: "value" })
    }).pipe(Effect.runPromise),
  )

  test.it("fails for invalid JSON string", async () => {
    const entity = Entity.make("not valid json")
    const result = await Effect.runPromiseExit(entity.json)

    test.expect(result._tag).toBe("Failure")
  })

  test.it("fails for unsupported body types", async () => {
    const entity = Entity.make(42 as any)
    const result = await Effect.runPromiseExit(entity.json)

    test.expect(result._tag).toBe("Failure")
  })
})

test.describe("bytes", () => {
  test.it("returns Uint8Array body directly", () =>
    Effect.gen(function* () {
      const bytes = new Uint8Array([1, 2, 3])
      const entity = Entity.make(bytes)
      const result = yield* entity.bytes

      test.expect(result).toBe(bytes)
    }).pipe(Effect.runPromise),
  )

  test.it("converts ArrayBuffer body to Uint8Array", () =>
    Effect.gen(function* () {
      const buffer = new ArrayBuffer(4)
      new Uint8Array(buffer).set([1, 2, 3, 4])
      const entity = Entity.make(buffer)
      const result = yield* entity.bytes

      test.expect(result).toEqual(new Uint8Array([1, 2, 3, 4]))
    }).pipe(Effect.runPromise),
  )

  test.it("encodes string body to Uint8Array", () =>
    Effect.gen(function* () {
      const entity = Entity.make("hello")
      const result = yield* entity.bytes

      test.expect(result).toEqual(new TextEncoder().encode("hello"))
    }).pipe(Effect.runPromise),
  )

  test.it("collects Stream body to Uint8Array", () =>
    Effect.gen(function* () {
      const chunk1 = new Uint8Array([1, 2])
      const chunk2 = new Uint8Array([3, 4])
      const stream = Stream.make(chunk1, chunk2)
      const entity = Entity.make(stream)
      const result = yield* entity.bytes

      test.expect(result).toEqual(new Uint8Array([1, 2, 3, 4]))
    }).pipe(Effect.runPromise),
  )

  test.it("serializes objects to JSON bytes", () =>
    Effect.gen(function* () {
      const entity = Entity.make({ key: "value" })
      const result = yield* entity.bytes
      const text = new TextDecoder().decode(result)

      test.expect(text).toBe('{"key":"value"}')
    }).pipe(Effect.runPromise),
  )
})

test.describe("stream", () => {
  test.it("returns Stream body content", () =>
    Effect.gen(function* () {
      const bytes = new Uint8Array([1, 2, 3])
      const entity = Entity.make(Stream.make(bytes))
      const chunks = yield* Stream.runCollect(entity.stream)

      test.expect(Array.from(chunks)).toEqual([bytes])
    }).pipe(Effect.runPromise),
  )

  test.it("converts Uint8Array body to stream", () =>
    Effect.gen(function* () {
      const bytes = new Uint8Array([1, 2, 3])
      const entity = Entity.make(bytes)
      const chunks = yield* Stream.runCollect(entity.stream)

      test.expect(Array.from(chunks)).toEqual([bytes])
    }).pipe(Effect.runPromise),
  )

  test.it("converts ArrayBuffer body to stream", () =>
    Effect.gen(function* () {
      const buffer = new ArrayBuffer(3)
      new Uint8Array(buffer).set([1, 2, 3])
      const entity = Entity.make(buffer)
      const chunks = yield* Stream.runCollect(entity.stream)

      test.expect(Array.from(chunks)).toEqual([new Uint8Array([1, 2, 3])])
    }).pipe(Effect.runPromise),
  )

  test.it("converts string body to stream", () =>
    Effect.gen(function* () {
      const entity = Entity.make("hello")
      const chunks = yield* Stream.runCollect(entity.stream)

      test.expect(Array.from(chunks)).toEqual([new TextEncoder().encode("hello")])
    }).pipe(Effect.runPromise),
  )
})

test.describe("Effect body", () => {
  test.it("executes lazily on accessor access", () =>
    Effect.gen(function* () {
      let count = 0
      const entity = Entity.make(
        Effect.sync(() => {
          count++
          return "hello"
        }),
      )

      test.expect(count).toBe(0)
      yield* entity.text
      test.expect(count).toBe(1)
    }).pipe(Effect.runPromise),
  )

  test.it("propagates Effect errors", async () => {
    const error = new ParseResult.ParseError({
      issue: new ParseResult.Type(Schema.String.ast, 123),
    })
    const effect = Effect.fail(error)
    const entity = Entity.make(effect)
    const result = await Effect.runPromiseExit(entity.text)

    test.expect(result._tag).toBe("Failure")
  })

  test.it("tracks error type in Entity accessors", () => {
    class CustomError extends Data.TaggedError("CustomError")<{
      readonly reason: string
    }> {}

    const entity = Entity.make(Effect.fail(new CustomError({ reason: "test" })))

    test
      .expectTypeOf<CustomError extends Effect.Effect.Error<typeof entity.text> ? true : false>()
      .toEqualTypeOf<true>()
  })

  test.it("text decodes Effect<Uint8Array> to string", () =>
    Effect.gen(function* () {
      const bytes = new TextEncoder().encode("hello world")
      const entity = Entity.make(Effect.succeed(bytes))
      const result = yield* entity.text

      test.expect(result).toBe("hello world")
    }).pipe(Effect.runPromise),
  )

  test.it("json parses Effect<string> as JSON", () =>
    Effect.gen(function* () {
      const entity = Entity.make(Effect.succeed('{"key":"value"}'))
      const result = yield* entity.json

      test.expect(result).toEqual({ key: "value" })
    }).pipe(Effect.runPromise),
  )

  test.it("bytes encodes Effect<string> to Uint8Array", () =>
    Effect.gen(function* () {
      const entity = Entity.make(Effect.succeed("hello"))
      const result = yield* entity.bytes

      test.expect(result).toEqual(new TextEncoder().encode("hello"))
    }).pipe(Effect.runPromise),
  )
})

test.describe("Pipeable interface", () => {
  test.it("supports piping", () => {
    const entity = Entity.make("hello")
    const piped = entity.pipe((e) => Entity.type(e))

    test.expect(piped).toBe("text/plain")
  })
})

test.describe("Proto getters", () => {
  test.it("entity.text returns text", () =>
    Effect.gen(function* () {
      const entity = Entity.make("hello")
      const result = yield* entity.text

      test.expect(result).toBe("hello")
    }).pipe(Effect.runPromise),
  )

  test.it("entity.json returns json", () =>
    Effect.gen(function* () {
      const data = { key: "value" }
      const entity = Entity.make(data)
      const result = yield* entity.json

      test.expect(result).toEqual(data)
    }).pipe(Effect.runPromise),
  )

  test.it("entity.bytes returns bytes", () =>
    Effect.gen(function* () {
      const bytes = new Uint8Array([1, 2, 3])
      const entity = Entity.make(bytes)
      const result = yield* entity.bytes

      test.expect(result).toBe(bytes)
    }).pipe(Effect.runPromise),
  )

  test.it("entity.stream returns stream", () =>
    Effect.gen(function* () {
      const bytes = new Uint8Array([1, 2, 3])
      const entity = Entity.make(bytes)
      const chunks = yield* Stream.runCollect(entity.stream)

      test.expect(Array.from(chunks)).toEqual([bytes])
    }).pipe(Effect.runPromise),
  )
})

test.describe("type inference", () => {
  test.it("infers correct body type from make()", () => {
    const stringEntity = Entity.make("hello")

    test.expectTypeOf(stringEntity.body).toEqualTypeOf<string>()

    const objectEntity = Entity.make({ key: "value" })

    test.expectTypeOf(objectEntity.body).toEqualTypeOf<{ key: string }>()

    const bytesEntity = Entity.make(new Uint8Array([1, 2, 3]))

    test.expect(bytesEntity.body instanceof Uint8Array).toBe(true)
  })

  test.it("text returns string for string body", () => {
    const entity = Entity.make("hello")

    test.expectTypeOf<Effect.Effect.Success<typeof entity.text>>().toEqualTypeOf<string>()
  })

  test.it("json returns T for object body", () => {
    const entity = Entity.make({ key: "value" })

    test.expectTypeOf<Effect.Effect.Success<typeof entity.json>>().toEqualTypeOf<{ key: string }>()
  })

  test.it("bytes returns Uint8Array for string body", () => {
    const entity = Entity.make("hello")

    test.expectTypeOf<Effect.Effect.Success<typeof entity.bytes>>().toEqualTypeOf<Uint8Array>()
  })

  test.it("stream returns Stream for string body", () => {
    const entity = Entity.make("hello")

    test.expectTypeOf<Stream.Stream.Success<typeof entity.stream>>().toEqualTypeOf<Uint8Array>()
  })
})
