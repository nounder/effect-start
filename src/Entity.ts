import * as Effect from "effect/Effect"
import * as ParseResult from "effect/ParseResult"
import * as Pipeable from "effect/Pipeable"
import * as Predicate from "effect/Predicate"
import * as Schema from "effect/Schema"
import * as Stream from "effect/Stream"
import * as StreamExtra from "./StreamExtra.ts"
import * as Values from "./Values.ts"

export const TypeId: unique symbol = Symbol.for("effect-start/Entity")
export type TypeId = typeof TypeId

const textDecoder = new TextDecoder()
const textEncoder = new TextEncoder()

function isBinary(v: unknown): v is Uint8Array | ArrayBuffer {
  return v instanceof Uint8Array || v instanceof ArrayBuffer
}

/**
 * Header keys are guaranteed to be lowercase.
 */
export type Headers = {
  [header: string]: string | null | undefined
}

export interface Entity<T = unknown, E = never> extends Pipeable.Pipeable {
  readonly [TypeId]: TypeId
  readonly body: T
  readonly headers: Headers
  /**
   * Accepts any valid URI (Uniform Resource Identifier), including URLs
   * (http://, https://, file://), URNs (urn:isbn:...), S3 URIs (s3://bucket/key),
   * data URIs, and other schemes. While commonly called "URL" in many APIs,
   * this property handles URIs as the correct superset term per RFC 3986.
   */
  readonly url: string | undefined
  readonly status: number | undefined
  readonly text: T extends string
    ? Effect.Effect<T, ParseResult.ParseError | E>
    : Effect.Effect<string, ParseResult.ParseError | E>
  readonly json: [T] extends [Effect.Effect<infer A, any, any>]
    ? Effect.Effect<
        A extends string | Uint8Array | ArrayBuffer ? unknown : A,
        ParseResult.ParseError | E
      >
    : [T] extends [Stream.Stream<any, any, any>]
      ? Effect.Effect<unknown, ParseResult.ParseError | E>
      : [T] extends [string | Uint8Array | ArrayBuffer]
        ? Effect.Effect<unknown, ParseResult.ParseError | E>
        : [T] extends [Values.Json]
          ? Effect.Effect<T, ParseResult.ParseError | E>
          : Effect.Effect<unknown, ParseResult.ParseError | E>
  readonly bytes: Effect.Effect<Uint8Array, ParseResult.ParseError | E>
  readonly stream: T extends Stream.Stream<infer A, infer E1, any>
    ? Stream.Stream<A, ParseResult.ParseError | E | E1>
    : Stream.Stream<Uint8Array, ParseResult.ParseError | E>
}

export interface Proto extends Pipeable.Pipeable {
  readonly [TypeId]: TypeId
}

function parseJson(s: string): Effect.Effect<unknown, ParseResult.ParseError> {
  try {
    return Effect.succeed(JSON.parse(s))
  } catch (e) {
    return Effect.fail(
      new ParseResult.ParseError({
        issue: new ParseResult.Type(
          Schema.Unknown.ast,
          s,
          e instanceof Error ? e.message : "Failed to parse JSON",
        ),
      }),
    )
  }
}

function getText(
  self: Entity<unknown, unknown>,
): Effect.Effect<string, ParseResult.ParseError | unknown> {
  const v = self.body
  if (StreamExtra.isStream(v)) {
    return Stream.mkString(Stream.decodeText(v as Stream.Stream<Uint8Array, unknown, never>))
  }
  if (Effect.isEffect(v)) {
    return Effect.flatMap(
      v as Effect.Effect<unknown, unknown, never>,
      (inner): Effect.Effect<string, ParseResult.ParseError | unknown> => {
        if (isEntity(inner)) {
          return inner.text
        }
        if (typeof inner === "string") {
          return Effect.succeed(inner)
        }
        if (isBinary(inner)) {
          return Effect.succeed(textDecoder.decode(inner))
        }
        return Effect.fail(mismatch(Schema.String, inner))
      },
    )
  }
  if (typeof v === "string") {
    return Effect.succeed(v)
  }
  if (isBinary(v)) {
    return Effect.succeed(textDecoder.decode(v))
  }
  return Effect.fail(mismatch(Schema.String, v))
}

function getJson(
  self: Entity<unknown, unknown>,
): Effect.Effect<unknown, ParseResult.ParseError | unknown> {
  const v = self.body
  if (StreamExtra.isStream(v)) {
    return Effect.flatMap(getText(self), parseJson)
  }
  if (Effect.isEffect(v)) {
    return Effect.flatMap(
      v as Effect.Effect<unknown, unknown, never>,
      (inner): Effect.Effect<unknown, ParseResult.ParseError | unknown> => {
        if (isEntity(inner)) {
          return inner.json
        }
        if (typeof inner === "object" && inner !== null && !isBinary(inner)) {
          return Effect.succeed(inner)
        }
        if (typeof inner === "string") {
          return parseJson(inner)
        }
        if (isBinary(inner)) {
          return parseJson(textDecoder.decode(inner))
        }
        return Effect.fail(mismatch(Schema.Unknown, inner))
      },
    )
  }
  if (typeof v === "object" && v !== null && !isBinary(v)) {
    return Effect.succeed(v)
  }
  if (typeof v === "string") {
    return parseJson(v)
  }
  if (isBinary(v)) {
    return parseJson(textDecoder.decode(v))
  }
  return Effect.fail(mismatch(Schema.Unknown, v))
}

function getBytes(
  self: Entity<unknown, unknown>,
): Effect.Effect<Uint8Array, ParseResult.ParseError | unknown> {
  const v = self.body
  if (StreamExtra.isStream(v)) {
    return Stream.runFold(
      v as Stream.Stream<Uint8Array, unknown, never>,
      new Uint8Array(0),
      Values.concatBytes,
    )
  }
  if (Effect.isEffect(v)) {
    return Effect.flatMap(
      v as Effect.Effect<unknown, unknown, never>,
      (inner): Effect.Effect<Uint8Array, ParseResult.ParseError | unknown> => {
        if (isEntity(inner)) {
          return inner.bytes
        }
        if (inner instanceof Uint8Array) {
          return Effect.succeed(inner)
        }
        if (inner instanceof ArrayBuffer) {
          return Effect.succeed(new Uint8Array(inner))
        }
        if (typeof inner === "string") {
          return Effect.succeed(textEncoder.encode(inner))
        }
        return Effect.fail(mismatch(Schema.Uint8ArrayFromSelf, inner))
      },
    )
  }
  if (v instanceof Uint8Array) {
    return Effect.succeed(v)
  }
  if (v instanceof ArrayBuffer) {
    return Effect.succeed(new Uint8Array(v))
  }
  if (typeof v === "string") {
    return Effect.succeed(textEncoder.encode(v))
  }
  // Allows entity.stream to work when body is a JSON object
  if (typeof v === "object" && v !== null && !isBinary(v)) {
    return Effect.succeed(textEncoder.encode(JSON.stringify(v)))
  }
  return Effect.fail(mismatch(Schema.Uint8ArrayFromSelf, v))
}

function getStream<A, E1, E2>(
  self: Entity<Stream.Stream<A, E1, never>, E2>,
): Stream.Stream<A, ParseResult.ParseError | E1 | E2>
function getStream<T, E>(self: Entity<T, E>): Stream.Stream<Uint8Array, ParseResult.ParseError | E>
function getStream(self: Entity<unknown, unknown>): Stream.Stream<unknown, unknown> {
  const v = self.body
  if (StreamExtra.isStream(v)) {
    return v as Stream.Stream<unknown, unknown, never>
  }
  if (Effect.isEffect(v)) {
    return Stream.unwrap(
      Effect.map(v as Effect.Effect<unknown, unknown, never>, (inner) => {
        if (isEntity(inner)) {
          return inner.stream
        }
        return Stream.fromEffect(getBytes(make(inner)))
      }),
    )
  }
  return Stream.fromEffect(getBytes(self))
}

const Proto: Proto = Object.defineProperties(Object.create(null), {
  [TypeId]: { value: TypeId },
  pipe: {
    value: function (this: Entity) {
      return Pipeable.pipeArguments(this, arguments)
    },
  },
  text: {
    get(this: Entity<unknown, unknown>) {
      return getText(this)
    },
  },
  json: {
    get(this: Entity<unknown, unknown>) {
      return getJson(this)
    },
  },
  bytes: {
    get(this: Entity<unknown, unknown>) {
      return getBytes(this)
    },
  },
  stream: {
    get(this: Entity<unknown, unknown>) {
      return getStream(this)
    },
  },
})

export function isEntity(input: unknown): input is Entity {
  return Predicate.hasProperty(input, TypeId)
}

interface Options {
  readonly headers?: Headers
  readonly url?: string
  readonly status?: number
}

export function make<A, E>(
  body: Effect.Effect<A, E, never>,
  options?: Options,
): Entity<Effect.Effect<A, E, never>, E>
export function make<A extends Uint8Array | string, E>(
  body: Stream.Stream<A, E, never>,
  options?: Options,
): Entity<Stream.Stream<A, E, never>, E>
export function make<T>(body: T, options?: Options): Entity<T, never>
export function make(body: unknown, options?: Options): Entity<unknown, unknown> {
  return Object.assign(Object.create(Proto), {
    body,
    headers: options?.headers ?? {},
    url: options?.url,
    status: options?.status,
  })
}

export function effect<A, E, R>(body: Effect.Effect<Entity<A> | A, E, R>): Entity<A, E> {
  return make(body) as unknown as Entity<A, E>
}

export function resolve<A, E>(entity: Entity<A, E>): Effect.Effect<Entity<A, E>, E, never> {
  const body = entity.body
  if (Effect.isEffect(body)) {
    return Effect.map(body as Effect.Effect<Entity<A> | A, E, never>, (inner) =>
      isEntity(inner)
        ? (inner as Entity<A, E>)
        : (make(inner as A, {
            status: entity.status,
            headers: entity.headers,
            url: entity.url,
          }) as Entity<A, E>),
    )
  }
  return Effect.succeed(entity)
}

export function type(self: Entity): string {
  const h = self.headers
  if (h["content-type"]) {
    return h["content-type"]
  }
  const v = self.body
  if (typeof v === "string") {
    return "text/plain"
  }
  if (typeof v === "object" && v !== null && !isBinary(v)) {
    return "application/json"
  }
  return "application/octet-stream"
}

export function length(self: Entity): number | undefined {
  const h = self.headers
  if (h["content-length"]) {
    return parseInt(h["content-length"], 10)
  }
  const v = self.body
  if (typeof v === "string") {
    return textEncoder.encode(v).byteLength
  }
  if (isBinary(v)) {
    return v.byteLength
  }
  return undefined
}

function mismatch(expected: Schema.Schema.Any, actual: unknown): ParseResult.ParseError {
  return new ParseResult.ParseError({
    issue: new ParseResult.Type(expected.ast, actual),
  })
}
