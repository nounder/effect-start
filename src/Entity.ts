import * as Data from "effect/Data"
import * as Effect from "effect/Effect"
import * as ParseResult from "effect/ParseResult"
import * as Pipeable from "effect/Pipeable"
import * as Predicate from "effect/Predicate"
import * as Schema from "effect/Schema"
import * as Stream from "effect/Stream"
import * as StreamExtra from "./StreamExtra.ts"
import * as Values from "./Values.ts"

export class EntityError extends Data.TaggedError("EntityError")<{
  readonly message: string
}> {}

export const TypeId: unique symbol = Symbol.for("effect-start/Entity")
export type TypeId = typeof TypeId

export type Headers = Record<string, string>

type TextResult<T> = StreamExtra.IsStream<T> extends true ? Effect.Effect<
    string,
    EntityError | ParseResult.ParseError | StreamExtra.StreamError<T>,
    StreamExtra.Requirements<T>
  >
  : T extends string ? Effect.Effect<T, EntityError | ParseResult.ParseError>
  : T extends Uint8Array | ArrayBuffer
    ? Effect.Effect<string, EntityError | ParseResult.ParseError>
  : never

type JsonResult<T> = StreamExtra.IsStream<T> extends true ? Effect.Effect<
    unknown,
    EntityError | ParseResult.ParseError | StreamExtra.StreamError<T>,
    StreamExtra.Requirements<T>
  >
  : T extends object ? Effect.Effect<T, EntityError | ParseResult.ParseError>
  : T extends string | Uint8Array | ArrayBuffer
    ? Effect.Effect<unknown, EntityError | ParseResult.ParseError>
  : never

type BytesResult<T> = StreamExtra.IsStream<T> extends true ? Effect.Effect<
    Uint8Array,
    EntityError | StreamExtra.StreamError<T>,
    StreamExtra.Requirements<T>
  >
  : T extends Uint8Array ? Effect.Effect<T, EntityError>
  : T extends ArrayBuffer ? Effect.Effect<Uint8Array, EntityError>
  : T extends string ? Effect.Effect<Uint8Array, EntityError>
  : never

type StreamResult<T> = StreamExtra.IsStream<T> extends true ? T
  : T extends Uint8Array
    ? Stream.Stream<T, EntityError | ParseResult.ParseError>
  : T extends ArrayBuffer
    ? Stream.Stream<Uint8Array, EntityError | ParseResult.ParseError>
  : T extends string
    ? Stream.Stream<Uint8Array, EntityError | ParseResult.ParseError>
  : never

export interface Entity<T = unknown> extends Pipeable.Pipeable {
  readonly [TypeId]: TypeId
  readonly body: T
  readonly headers: Headers | undefined
  /**
   * Accepts any valid URI (Uniform Resource Identifier), including URLs
   * (http://, https://, file://), URNs (urn:isbn:...), S3 URIs (s3://bucket/key),
   * data URIs, and other schemes. While commonly called "URL" in many APIs,
   * this property handles URIs as the correct superset term per RFC 3986.
   */
  readonly url: string | undefined
  readonly status: number | undefined
  readonly text: TextResult<T>
  readonly json: JsonResult<T>
  readonly bytes: BytesResult<T>
  readonly stream: StreamResult<T>
}

export interface Proto extends Pipeable.Pipeable {
  readonly [TypeId]: TypeId
}

const Proto: Proto = Object.defineProperties(
  Object.create(null),
  {
    [TypeId]: { value: TypeId },
    pipe: {
      value: function(this: Entity) {
        return Pipeable.pipeArguments(this, arguments)
      },
    },
    text: {
      get(this: Entity) {
        return text(this)
      },
    },
    json: {
      get(this: Entity) {
        return json(this)
      },
    },
    bytes: {
      get(this: Entity) {
        return bytes(this)
      },
    },
    stream: {
      get(this: Entity) {
        return stream(this)
      },
    },
  },
)

export function isEntity(input: unknown): input is Entity {
  return Predicate.hasProperty(input, TypeId)
}

export interface Options {
  readonly headers?: Headers
  readonly url?: string
  readonly status?: number
}

export function make<T>(body: T, options?: Options): Entity<T> {
  return Object.assign(
    Object.create(Proto),
    {
      body,
      headers: options?.headers,
      url: options?.url,
      status: options?.status,
    },
  )
}

export function type(self: Entity): string | undefined {
  const h = self.headers
  if (h?.["content-type"]) {
    return h["content-type"]
  }
  const v = self.body
  if (typeof v === "string") {
    return "text/plain"
  }
  if (v instanceof Uint8Array || v instanceof ArrayBuffer) {
    return "application/octet-stream"
  }
  if (typeof v === "object" && v !== null) {
    return "application/json"
  }
  return undefined
}

export function length(self: Entity): number | undefined {
  const h = self.headers
  if (h?.["content-length"]) {
    return parseInt(h["content-length"], 10)
  }
  const v = self.body
  if (typeof v === "string") {
    return new TextEncoder().encode(v).byteLength
  }
  if (v instanceof Uint8Array) {
    return v.byteLength
  }
  if (v instanceof ArrayBuffer) {
    return v.byteLength
  }
  if (typeof v === "object" && v !== null) {
    return new TextEncoder().encode(JSON.stringify(v)).byteLength
  }
  return undefined
}

export function text<T extends string>(
  self: Entity<T>,
): Effect.Effect<T, EntityError | ParseResult.ParseError>
export function text<T extends Uint8Array | ArrayBuffer>(
  self: Entity<T>,
): Effect.Effect<string, EntityError | ParseResult.ParseError>
export function text<A extends Uint8Array, E, R>(
  self: Entity<Stream.Stream<A, E, R>>,
): Effect.Effect<string, EntityError | ParseResult.ParseError | E, R>
export function text(
  self: Entity,
): Effect.Effect<string, EntityError | ParseResult.ParseError, any>
export function text(
  self: Entity,
): Effect.Effect<string, EntityError | ParseResult.ParseError, any> {
  const v = self.body
  if (StreamExtra.isStream(v)) {
    const s = v as Stream.Stream<Uint8Array, unknown, unknown>
    return Stream.mkString(Stream.decodeText(s)) as Effect.Effect<
      string,
      EntityError | ParseResult.ParseError,
      any
    >
  }
  if (typeof v === "string") {
    return Effect.succeed(v)
  }
  if (v instanceof Uint8Array || v instanceof ArrayBuffer) {
    return Effect.succeed(new TextDecoder().decode(v))
  }
  return Effect.fail(
    new EntityError({ message: `Cannot read entity as text: ${typeof v}` }),
  )
}

export function json<T extends object>(
  self: Entity<T>,
): Effect.Effect<T, EntityError | ParseResult.ParseError>
export function json<T extends string | Uint8Array | ArrayBuffer>(
  self: Entity<T>,
): Effect.Effect<unknown, EntityError | ParseResult.ParseError>
export function json<A extends Uint8Array, E, R>(
  self: Entity<Stream.Stream<A, E, R>>,
): Effect.Effect<unknown, EntityError | ParseResult.ParseError | E, R>
export function json(
  self: Entity,
): Effect.Effect<unknown, EntityError | ParseResult.ParseError, any>
export function json(
  self: Entity,
): Effect.Effect<unknown, EntityError | ParseResult.ParseError, any> {
  const v = self.body
  if (StreamExtra.isStream(v)) {
    return Effect.flatMap(text(self), parseJson) as Effect.Effect<
      unknown,
      EntityError | ParseResult.ParseError,
      any
    >
  }
  if (
    typeof v === "object"
    && !(v instanceof Uint8Array)
    && !(v instanceof ArrayBuffer)
  ) {
    return Effect.succeed(v)
  }
  if (typeof v === "string") {
    return parseJson(v)
  }
  if (v instanceof Uint8Array || v instanceof ArrayBuffer) {
    return parseJson(new TextDecoder().decode(v))
  }
  return Effect.fail(
    new EntityError({ message: `Cannot read entity as json: ${typeof v}` }),
  )
}

function parseJson(s: string): Effect.Effect<unknown, ParseResult.ParseError> {
  try {
    return Effect.succeed(JSON.parse(s))
  } catch (error) {
    return Effect.fail(
      new ParseResult.ParseError({
        issue: new ParseResult.Type(
          Schema.Unknown.ast,
          s,
          "Failed to parse JSON",
        ),
      }),
    )
  }
}

export function bytes<T extends Uint8Array>(
  self: Entity<T>,
): Effect.Effect<T, EntityError>
export function bytes<T extends ArrayBuffer>(
  self: Entity<T>,
): Effect.Effect<Uint8Array, EntityError>
export function bytes<T extends string>(
  self: Entity<T>,
): Effect.Effect<Uint8Array, EntityError>
export function bytes<A extends Uint8Array, E, R>(
  self: Entity<Stream.Stream<A, E, R>>,
): Effect.Effect<Uint8Array, EntityError | E, R>
export function bytes(self: Entity): Effect.Effect<Uint8Array, EntityError, any>
export function bytes(
  self: Entity,
): Effect.Effect<Uint8Array, EntityError, any> {
  const v = self.body
  if (StreamExtra.isStream(v)) {
    const s = v as Stream.Stream<Uint8Array, unknown, unknown>
    return Stream.runFold(
      s,
      new Uint8Array(0),
      Values.concatBytes,
    ) as Effect.Effect<
      Uint8Array,
      EntityError,
      any
    >
  }
  if (v instanceof Uint8Array) {
    return Effect.succeed(v)
  }
  if (v instanceof ArrayBuffer) {
    return Effect.succeed(new Uint8Array(v))
  }
  if (typeof v === "string") {
    return Effect.succeed(new TextEncoder().encode(v))
  }
  return Effect.fail(
    new EntityError({ message: `Cannot read entity as bytes: ${typeof v}` }),
  )
}

export function stream<A extends Uint8Array, E, R>(
  self: Entity<Stream.Stream<A, E, R>>,
): Stream.Stream<A, E, R>
export function stream<T extends Uint8Array>(
  self: Entity<T>,
): Stream.Stream<T, EntityError | ParseResult.ParseError>
export function stream<T extends ArrayBuffer>(
  self: Entity<T>,
): Stream.Stream<Uint8Array, EntityError | ParseResult.ParseError>
export function stream<T extends string>(
  self: Entity<T>,
): Stream.Stream<Uint8Array, EntityError | ParseResult.ParseError>
export function stream(
  self: Entity,
): Stream.Stream<Uint8Array, EntityError | ParseResult.ParseError, any>
export function stream(
  self: Entity,
): Stream.Stream<Uint8Array, any, any> {
  const v = self.body
  if (StreamExtra.isStream(v)) {
    return v as Stream.Stream<Uint8Array, any, any>
  }
  return Stream.fromEffect(bytes(self))
}
