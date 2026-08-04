import * as Effect from "effect/Effect"
import * as ParseResult from "effect/ParseResult"
import * as PubSub from "effect/PubSub"
import * as Schema from "effect/Schema"
import * as Stream from "effect/Stream"
import * as NZlib from "node:zlib"
import * as Entity from "../../Entity.ts"
import type * as Tracing from "../../internal/Tracing.ts"
import * as Route from "../../Route.ts"
import * as SqlClient from "../../sql/SqlClient.ts"
import * as Unique from "../../Unique.ts"
import * as Studio from "../Studio.ts"
import * as StudioStore from "../StudioStore.ts"

type OpenTelemetrySignal = "traces" | "logs" | "metrics"
type JsonObject = Record<string, unknown>

type WireValue =
  | { readonly wireType: 0; readonly value: bigint }
  | { readonly wireType: 1; readonly value: Uint8Array }
  | { readonly wireType: 2; readonly value: Uint8Array }
  | { readonly wireType: 5; readonly value: Uint8Array }

type ProtoMessage = ReadonlyMap<number, ReadonlyArray<WireValue>>
type Input = JsonObject | ProtoMessage
type Path = ReadonlyArray<string | number>

interface Parsed<A> {
  readonly values: Array<A>
  readonly rejected: number
}

const MAX_REQUEST_BYTES = 64 * 1024 * 1024
const METRIC_CAPACITY = 50_000
const textDecoder = new TextDecoder()
const textEncoder = new TextEncoder()
const emptyBytes = new Uint8Array()

interface ProtocolError {
  readonly _tag: "ProtocolError"
  readonly status: 413 | 415
  readonly message: string
}

const protocolError = (status: 413 | 415, message: string): ProtocolError => ({
  _tag: "ProtocolError",
  status,
  message,
})

function parseError(actual: unknown, message: string, path: Path = []) {
  const issue = new ParseResult.Type(Schema.Unknown.ast, actual, message)
  return new ParseResult.ParseError({
    issue: path.length === 0
      ? issue
      : new ParseResult.Pointer(path as [PropertyKey, ...Array<PropertyKey>], actual, issue),
  })
}

function asObject(value: unknown): JsonObject | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as JsonObject
    : undefined
}

function readVarint(
  bytes: Uint8Array,
  initialOffset: number,
  path: Path,
  description: string,
): Effect.Effect<{ readonly value: bigint; readonly offset: number }, ParseResult.ParseError> {
  return Effect.gen(function*() {
    let value = 0n
    let offset = initialOffset
    for (let index = 0; index < 10; index++) {
      if (offset >= bytes.length) {
        return yield* Effect.fail(parseError(bytes, `Truncated ${description}`, path))
      }
      const byte = bytes[offset++]
      if (index === 9 && (byte & 0xfe) !== 0) {
        return yield* Effect.fail(parseError(bytes, `Overlong ${description}`, path))
      }
      value |= BigInt(byte & 0x7f) << BigInt(index * 7)
      if ((byte & 0x80) === 0) return { value, offset }
    }
    return yield* Effect.fail(parseError(bytes, `Overlong ${description}`, path))
  })
}

function decodeMessage(
  bytes: Uint8Array,
  path: Path,
): Effect.Effect<ProtoMessage, ParseResult.ParseError> {
  return Effect.gen(function*() {
    const fields = new Map<number, Array<WireValue>>()
    let offset = 0
    while (offset < bytes.length) {
      const tag = yield* readVarint(bytes, offset, path, "protobuf field tag")
      offset = tag.offset
      const fieldNumber = Number(tag.value >> 3n)
      const wireType = Number(tag.value & 7n)
      if (fieldNumber === 0) {
        return yield* Effect.fail(parseError(bytes, "Malformed protobuf field number", path))
      }
      const fieldPath = [...path, `protobufField(${fieldNumber})`]

      let value: WireValue
      if (wireType === 0) {
        const item = yield* readVarint(
          bytes,
          offset,
          fieldPath,
          "protobuf varint",
        )
        offset = item.offset
        value = { wireType: 0, value: item.value }
      } else if (wireType === 1) {
        if (offset + 8 > bytes.length) {
          return yield* Effect.fail(
            parseError(bytes, "Truncated protobuf fixed64 field", fieldPath),
          )
        }
        value = { wireType: 1, value: bytes.slice(offset, offset + 8) }
        offset += 8
      } else if (wireType === 2) {
        const length = yield* readVarint(
          bytes,
          offset,
          fieldPath,
          "protobuf field length",
        )
        offset = length.offset
        const size = Number(length.value)
        if (!Number.isSafeInteger(size) || size < 0 || offset + size > bytes.length) {
          return yield* Effect.fail(
            parseError(bytes, "Invalid protobuf field length", fieldPath),
          )
        }
        value = { wireType: 2, value: bytes.slice(offset, offset + size) }
        offset += size
      } else if (wireType === 5) {
        if (offset + 4 > bytes.length) {
          return yield* Effect.fail(
            parseError(bytes, "Truncated protobuf fixed32 field", fieldPath),
          )
        }
        value = { wireType: 5, value: bytes.slice(offset, offset + 4) }
        offset += 4
      } else {
        return yield* Effect.fail(
          parseError(bytes, `Unsupported protobuf wire type ${wireType}`, fieldPath),
        )
      }

      let items = fields.get(fieldNumber)
      if (!items) {
        items = []
        fields.set(fieldNumber, items)
      }
      items.push(value)
    }
    return fields
  })
}

function isProtoMessage(input: Input): input is ProtoMessage {
  return input instanceof Map
}

function wireValues(input: Input, fieldNumber: number): ReadonlyArray<WireValue> {
  return isProtoMessage(input) ? input.get(fieldNumber) ?? [] : []
}

function messages(
  input: Input,
  jsonKey: string,
  fieldNumber: number,
  path: Path,
): Effect.Effect<Array<Input>, ParseResult.ParseError> {
  if (isProtoMessage(input)) {
    const values = wireValues(input, fieldNumber).filter(
      (item): item is Extract<WireValue, { wireType: 2 }> => item.wireType === 2,
    )
    return Effect.forEach(values, (item, index) => decodeMessage(item.value, [...path, jsonKey, index]))
  }
  const value = input[jsonKey]
  return Effect.succeed(
    Array.isArray(value)
      ? value.map(asObject).filter((item): item is JsonObject => item !== undefined)
      : [],
  )
}

function message(
  input: Input,
  jsonKey: string,
  fieldNumber: number,
  path: Path,
): Effect.Effect<Input | undefined, ParseResult.ParseError> {
  if (isProtoMessage(input)) {
    const item = wireValues(input, fieldNumber).find((value) => value.wireType === 2)
    return item?.wireType === 2
      ? decodeMessage(item.value, [...path, jsonKey])
      : Effect.succeed(undefined)
  }
  return Effect.succeed(asObject(input[jsonKey]))
}

function hasField(input: Input, jsonKey: string, fieldNumber: number): boolean {
  return isProtoMessage(input)
    ? wireValues(input, fieldNumber).length > 0
    : input[jsonKey] !== undefined && input[jsonKey] !== null
}

function stringValue(
  input: Input,
  jsonKey: string,
  fieldNumber: number,
): string | undefined {
  if (isProtoMessage(input)) {
    const item = wireValues(input, fieldNumber).find((value) => value.wireType === 2)
    return item?.wireType === 2 ? textDecoder.decode(item.value) : undefined
  }
  const value = input[jsonKey]
  return typeof value === "string" ? value : undefined
}

function varintValue(
  input: Input,
  jsonKey: string,
  fieldNumber: number,
): bigint | undefined {
  if (isProtoMessage(input)) {
    const item = wireValues(input, fieldNumber).find((value) => value.wireType === 0)
    return item?.wireType === 0 ? item.value : undefined
  }
  const value = input[jsonKey]
  if (typeof value === "bigint") return value
  if (typeof value === "boolean") return value ? 1n : 0n
  if (typeof value === "number" && Number.isFinite(value)) return BigInt(Math.trunc(value))
  if (typeof value === "string" && /^-?\d+$/.test(value)) return BigInt(value)
  return undefined
}

function littleEndian(bytes: Uint8Array): bigint {
  let value = 0n
  for (let i = bytes.length - 1; i >= 0; i--) {
    value = (value << 8n) | BigInt(bytes[i])
  }
  return value
}

function fixed64Value(
  input: Input,
  jsonKey: string,
  fieldNumber: number,
): bigint | undefined {
  if (isProtoMessage(input)) {
    const item = wireValues(input, fieldNumber).find((value) => value.wireType === 1)
    return item?.wireType === 1 ? littleEndian(item.value) : undefined
  }
  return varintValue(input, jsonKey, fieldNumber)
}

function fixed32Value(
  input: Input,
  jsonKey: string,
  fieldNumber: number,
): number | undefined {
  if (isProtoMessage(input)) {
    const item = wireValues(input, fieldNumber).find((value) => value.wireType === 5)
    return item?.wireType === 5 ? Number(littleEndian(item.value)) : undefined
  }
  const value = varintValue(input, jsonKey, fieldNumber)
  return value !== undefined ? Number(value) : undefined
}

function doubleFromBytes(bytes: Uint8Array): number {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getFloat64(0, true)
}

function doubleValue(
  input: Input,
  jsonKey: string,
  fieldNumber: number,
): number | undefined {
  if (isProtoMessage(input)) {
    const item = wireValues(input, fieldNumber).find((value) => value.wireType === 1)
    return item?.wireType === 1 ? doubleFromBytes(item.value) : undefined
  }
  const value = input[jsonKey]
  if (typeof value === "number") return value
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value)
    return Number.isNaN(parsed) ? undefined : parsed
  }
  return undefined
}

function signedFixed64Value(
  input: Input,
  jsonKey: string,
  fieldNumber: number,
): bigint | undefined {
  const value = fixed64Value(input, jsonKey, fieldNumber)
  return value !== undefined && value >= 0x8000000000000000n
    ? value - 0x10000000000000000n
    : value
}

function sint32Value(
  input: Input,
  jsonKey: string,
  fieldNumber: number,
): number | undefined {
  const value = varintValue(input, jsonKey, fieldNumber)
  if (value === undefined) return undefined
  if (!isProtoMessage(input)) return Number(value)
  return Number((value >> 1n) ^ -(value & 1n))
}

function packedFixed64(
  input: Input,
  jsonKey: string,
  fieldNumber: number,
  path: Path,
): Effect.Effect<Array<bigint>, ParseResult.ParseError> {
  if (!isProtoMessage(input)) {
    const values = input[jsonKey]
    return Effect.succeed(
      Array.isArray(values)
        ? values.flatMap((value) => {
          if (typeof value === "bigint") return [value]
          if (typeof value === "number" && Number.isFinite(value)) return [BigInt(Math.trunc(value))]
          if (typeof value === "string" && /^\d+$/.test(value)) return [BigInt(value)]
          return []
        })
        : [],
    )
  }

  const out: Array<bigint> = []
  for (const item of wireValues(input, fieldNumber)) {
    if (item.wireType === 1) {
      out.push(littleEndian(item.value))
    } else if (item.wireType === 2) {
      if (item.value.length % 8 !== 0) {
        return Effect.fail(parseError(item.value, "Invalid packed fixed64 field", [...path, jsonKey]))
      }
      for (let offset = 0; offset < item.value.length; offset += 8) {
        out.push(littleEndian(item.value.subarray(offset, offset + 8)))
      }
    }
  }
  return Effect.succeed(out)
}

function packedDoubles(
  input: Input,
  jsonKey: string,
  fieldNumber: number,
  path: Path,
): Effect.Effect<Array<number>, ParseResult.ParseError> {
  if (!isProtoMessage(input)) {
    const values = input[jsonKey]
    return Effect.succeed(
      Array.isArray(values)
        ? values.map(Number).filter((value) => !Number.isNaN(value))
        : [],
    )
  }

  const out: Array<number> = []
  for (const item of wireValues(input, fieldNumber)) {
    if (item.wireType === 1) {
      out.push(doubleFromBytes(item.value))
    } else if (item.wireType === 2) {
      if (item.value.length % 8 !== 0) {
        return Effect.fail(parseError(item.value, "Invalid packed double field", [...path, jsonKey]))
      }
      for (let offset = 0; offset < item.value.length; offset += 8) {
        out.push(doubleFromBytes(item.value.subarray(offset, offset + 8)))
      }
    }
  }
  return Effect.succeed(out)
}

function packedVarints(
  input: Input,
  jsonKey: string,
  fieldNumber: number,
  path: Path,
): Effect.Effect<Array<bigint>, ParseResult.ParseError> {
  if (!isProtoMessage(input)) {
    const values = input[jsonKey]
    return Effect.succeed(
      Array.isArray(values)
        ? values.flatMap((value) => {
          if (typeof value === "bigint") return [value]
          if (typeof value === "number" && Number.isFinite(value)) return [BigInt(Math.trunc(value))]
          if (typeof value === "string" && /^\d+$/.test(value)) return [BigInt(value)]
          return []
        })
        : [],
    )
  }

  return Effect.gen(function*() {
    const out: Array<bigint> = []
    for (const item of wireValues(input, fieldNumber)) {
      if (item.wireType === 0) {
        out.push(item.value)
      } else if (item.wireType === 2) {
        let offset = 0
        while (offset < item.value.length) {
          const value = yield* readVarint(
            item.value,
            offset,
            [...path, jsonKey],
            "packed protobuf varint",
          )
          offset = value.offset
          out.push(value.value)
        }
      }
    }
    return out
  })
}

function bytesHex(
  input: Input,
  jsonKey: string,
  fieldNumber: number,
): string | undefined {
  if (isProtoMessage(input)) {
    const item = wireValues(input, fieldNumber).find((value) => value.wireType === 2)
    return item?.wireType === 2 ? item.value.toHex() : undefined
  }
  const value = input[jsonKey]
  return typeof value === "string" ? value.toLowerCase() : undefined
}

function attributeBytes(
  input: Input,
  jsonKey: string,
  fieldNumber: number,
): string | undefined {
  if (isProtoMessage(input)) {
    const item = wireValues(input, fieldNumber).find((value) => value.wireType === 2)
    return item?.wireType === 2 ? `0x${item.value.toHex()}` : undefined
  }
  const value = input[jsonKey]
  return typeof value === "string" ? `base64:${value}` : undefined
}

function anyValue(
  input: Input | undefined,
  path: Path,
): Effect.Effect<unknown, ParseResult.ParseError> {
  return Effect.gen(function*() {
    if (!input) return undefined
    const stringItem = stringValue(input, "stringValue", 1)
    if (stringItem !== undefined) return stringItem
    if (hasField(input, "boolValue", 2)) return varintValue(input, "boolValue", 2) !== 0n
    const intItem = varintValue(input, "intValue", 3)
    if (intItem !== undefined) {
      const signed = intItem >= 0x8000000000000000n
        ? intItem - 0x10000000000000000n
        : intItem
      return signed >= BigInt(Number.MIN_SAFE_INTEGER) && signed <= BigInt(Number.MAX_SAFE_INTEGER)
        ? Number(signed)
        : signed.toString()
    }
    const doubleItem = doubleValue(input, "doubleValue", 4)
    if (doubleItem !== undefined) return doubleItem
    const arrayItem = yield* message(input, "arrayValue", 5, path)
    if (arrayItem) {
      const values = yield* messages(arrayItem, "values", 1, [...path, "arrayValue"])
      return yield* Effect.forEach(values, (value, index) => anyValue(value, [...path, "arrayValue", "values", index]))
    }
    const listItem = yield* message(input, "kvlistValue", 6, path)
    if (listItem) return yield* attributes(listItem, "values", 1, [...path, "kvlistValue"])
    const bytesItem = attributeBytes(input, "bytesValue", 7)
    if (bytesItem !== undefined) return bytesItem
    return undefined
  })
}

function attributes(
  input: Input,
  jsonKey: string,
  fieldNumber: number,
  path: Path,
): Effect.Effect<Record<string, unknown>, ParseResult.ParseError> {
  return Effect.gen(function*() {
    const out: Record<string, unknown> = {}
    const items = yield* messages(input, jsonKey, fieldNumber, path)
    for (let index = 0; index < items.length; index++) {
      const item = items[index]
      const itemPath = [...path, jsonKey, index]
      const key = stringValue(item, "key", 1)
      if (!key) continue
      const value = yield* message(item, "value", 2, itemPath)
      out[key] = yield* anyValue(value, [...itemPath, "value"])
    }
    return out
  })
}

function resourceData(
  input: Input,
  path: Path,
): Effect.Effect<Tracing.Resource, ParseResult.ParseError> {
  return Effect.gen(function*() {
    const resource = yield* message(input, "resource", 1, path)
    return {
      attributes: resource
        ? yield* attributes(resource, "attributes", 1, [...path, "resource"])
        : {},
      droppedAttributesCount: resource
        ? Number(varintValue(resource, "droppedAttributesCount", 2) ?? 0n)
        : 0,
      schemaUrl: stringValue(input, "schemaUrl", 3),
    }
  })
}

function scopeData(
  input: Input,
  path: Path,
): Effect.Effect<Tracing.InstrumentationScope, ParseResult.ParseError> {
  return Effect.gen(function*() {
    const scope = yield* message(input, "scope", 1, path)
    return {
      name: scope ? stringValue(scope, "name", 1) : undefined,
      version: scope ? stringValue(scope, "version", 2) : undefined,
      attributes: scope
        ? yield* attributes(scope, "attributes", 3, [...path, "scope"])
        : {},
      droppedAttributesCount: scope
        ? Number(varintValue(scope, "droppedAttributesCount", 4) ?? 0n)
        : 0,
      schemaUrl: stringValue(input, "schemaUrl", 3),
    }
  })
}

function validId(id: string | undefined, length: number): id is string {
  return id !== undefined && id.length === length && /^[0-9a-f]+$/i.test(id) && !/^0+$/.test(id)
}

function parseTraces(root: Input): Effect.Effect<Parsed<Tracing.Span>, ParseResult.ParseError> {
  return Effect.gen(function*() {
    const values: Array<Tracing.Span> = []
    let rejected = 0
    const resourceSpansValues = yield* messages(root, "resourceSpans", 1, [])
    for (let resourceIndex = 0; resourceIndex < resourceSpansValues.length; resourceIndex++) {
      const resourceSpans = resourceSpansValues[resourceIndex]
      const resourcePath = ["resourceSpans", resourceIndex] as const
      const resource = yield* resourceData(resourceSpans, resourcePath)
      const scopeSpansValues = yield* messages(resourceSpans, "scopeSpans", 2, resourcePath)
      for (let scopeIndex = 0; scopeIndex < scopeSpansValues.length; scopeIndex++) {
        const scopeSpans = scopeSpansValues[scopeIndex]
        const scopePath = [...resourcePath, "scopeSpans", scopeIndex]
        const scope = yield* scopeData(scopeSpans, scopePath)
        const spanValues = yield* messages(scopeSpans, "spans", 2, scopePath)
        for (let spanIndex = 0; spanIndex < spanValues.length; spanIndex++) {
          const input = spanValues[spanIndex]
          const spanPath = [...scopePath, "spans", spanIndex]
          const traceId = bytesHex(input, "traceId", 1)
          const spanId = bytesHex(input, "spanId", 2)
          if (!validId(traceId, 32) || !validId(spanId, 16)) {
            rejected++
            continue
          }

          const parentSpanId = bytesHex(input, "parentSpanId", 4)
          const startTime = fixed64Value(input, "startTimeUnixNano", 7) ?? 0n
          const endTimeValue = fixed64Value(input, "endTimeUnixNano", 8) ?? 0n
          if (startTime === 0n || endTimeValue < startTime) {
            rejected++
            continue
          }
          const endTime = endTimeValue
          const spanAttributes = yield* attributes(input, "attributes", 9, spanPath)
          const fiberId = `otlp:${traceId}`
          const outputAttributes: Record<string, unknown> = {
            ...spanAttributes,
            "fiber.id": fiberId,
          }
          const traceState = stringValue(input, "traceState", 3)
          const flags = fixed32Value(input, "flags", 16)
          const droppedAttributes = varintValue(input, "droppedAttributesCount", 10)
          const droppedEvents = varintValue(input, "droppedEventsCount", 12)
          const droppedLinks = varintValue(input, "droppedLinksCount", 14)
          if (traceState) outputAttributes["otel.trace_state"] = traceState
          if (flags !== undefined) outputAttributes["otel.span.flags"] = flags
          if (droppedAttributes && droppedAttributes > 0n) {
            outputAttributes["otel.span.dropped_attributes_count"] = Number(droppedAttributes)
          }
          if (droppedEvents && droppedEvents > 0n) {
            outputAttributes["otel.span.dropped_events_count"] = Number(droppedEvents)
          }
          if (droppedLinks && droppedLinks > 0n) {
            outputAttributes["otel.span.dropped_links_count"] = Number(droppedLinks)
          }

          const linkValues = yield* messages(input, "links", 13, spanPath)
          const links = yield* Effect.forEach(linkValues, (link, linkIndex) => {
            const linkPath = [...spanPath, "links", linkIndex]
            return Effect.map(attributes(link, "attributes", 4, linkPath), (linkAttributes) => ({
              traceId: bytesHex(link, "traceId", 1),
              spanId: bytesHex(link, "spanId", 2),
              traceState: stringValue(link, "traceState", 3),
              attributes: linkAttributes,
              droppedAttributesCount: Number(varintValue(link, "droppedAttributesCount", 5) ?? 0n),
              flags: fixed32Value(link, "flags", 6) ?? 0,
            }))
          })
          if (links.length > 0) outputAttributes["otel.span.links"] = links

          const statusInput = yield* message(input, "status", 15, spanPath)
          const statusCode = statusInput ? Number(varintValue(statusInput, "code", 3) ?? 0n) : 0
          const statusMessage = statusInput ? stringValue(statusInput, "message", 2) : undefined
          if (statusInput) outputAttributes["otel.status.code"] = statusCode
          if (statusMessage) outputAttributes["otel.status.message"] = statusMessage

          const eventValues = yield* messages(input, "events", 11, spanPath)
          const events = yield* Effect.forEach(eventValues, (event, eventIndex) =>
            Effect.map(
              attributes(event, "attributes", 3, [...spanPath, "events", eventIndex]),
              (eventAttributes) => {
                const eventDropped = varintValue(event, "droppedAttributesCount", 4)
                if (eventDropped && eventDropped > 0n) {
                  eventAttributes["otel.event.dropped_attributes_count"] = Number(eventDropped)
                }
                return {
                  name: stringValue(event, "name", 2) || "event",
                  startTime: fixed64Value(event, "timeUnixNano", 1) ?? startTime,
                  attributes: eventAttributes,
                }
              },
            ))

          values.push({
            spanId,
            traceId,
            fiberId,
            name: stringValue(input, "name", 5) || "unknown",
            kind: [
              "internal",
              "internal",
              "server",
              "client",
              "producer",
              "consumer",
            ][Number(varintValue(input, "kind", 6) ?? 0n)] ?? "internal",
            parentSpanId: validId(parentSpanId, 16) ? parentSpanId : undefined,
            startTime,
            endTime,
            durationMs: Number(endTime - startTime) / 1_000_000,
            status: statusCode === 2 ? "error" : "ok",
            attributes: outputAttributes,
            resource,
            instrumentationScope: scope,
            events,
          })
        }
      }
    }
    return { values, rejected }
  })
}

function logLevel(severity: number, severityText: string | undefined): StudioStore.LogEntry["level"] {
  if (severity >= 21) return "FATAL"
  if (severity >= 17) return "ERROR"
  if (severity >= 13) return "WARNING"
  if (severity >= 9) return "INFO"
  const text = severityText?.toUpperCase()
  if (text?.includes("FATAL")) return "FATAL"
  if (text?.includes("ERROR")) return "ERROR"
  if (text?.includes("WARN")) return "WARNING"
  if (text?.includes("INFO")) return "INFO"
  return "DEBUG"
}

function parseLogs(root: Input): Effect.Effect<Parsed<StudioStore.LogEntry>, ParseResult.ParseError> {
  return Effect.gen(function*() {
    const values: Array<StudioStore.LogEntry> = []
    const resourceLogsValues = yield* messages(root, "resourceLogs", 1, [])
    for (let resourceIndex = 0; resourceIndex < resourceLogsValues.length; resourceIndex++) {
      const resourceLogs = resourceLogsValues[resourceIndex]
      const resourcePath = ["resourceLogs", resourceIndex] as const
      const resource = yield* resourceData(resourceLogs, resourcePath)
      const scopeLogsValues = yield* messages(resourceLogs, "scopeLogs", 2, resourcePath)
      for (let scopeIndex = 0; scopeIndex < scopeLogsValues.length; scopeIndex++) {
        const scopeLogs = scopeLogsValues[scopeIndex]
        const scopePath = [...resourcePath, "scopeLogs", scopeIndex]
        const scope = yield* scopeData(scopeLogs, scopePath)
        const recordValues = yield* messages(scopeLogs, "logRecords", 2, scopePath)
        for (let recordIndex = 0; recordIndex < recordValues.length; recordIndex++) {
          const input = recordValues[recordIndex]
          const recordPath = [...scopePath, "logRecords", recordIndex]
          const timeUnixNano = fixed64Value(input, "timeUnixNano", 1) ?? 0n
          const observedTimeUnixNano = fixed64Value(input, "observedTimeUnixNano", 11) ?? 0n
          const timestampNano = timeUnixNano > 0n ? timeUnixNano : observedTimeUnixNano
          const timestamp = timestampNano > 0n ? Number(timestampNano / 1_000_000n) : Date.now()
          const severity = Number(varintValue(input, "severityNumber", 2) ?? 0n)
          const severityText = stringValue(input, "severityText", 3)
          const bodyInput = yield* message(input, "body", 5, recordPath)
          const body = yield* anyValue(bodyInput, [...recordPath, "body"])
          const eventName = stringValue(input, "eventName", 12)
          const recordAttributes = yield* attributes(input, "attributes", 6, recordPath)
          const traceId = bytesHex(input, "traceId", 9)
          const spanId = bytesHex(input, "spanId", 10)
          const annotations: Record<string, unknown> = {
            ...recordAttributes,
            "otel.log.time_unix_nano": timeUnixNano.toString(),
            "otel.log.observed_time_unix_nano": observedTimeUnixNano.toString(),
          }
          if (traceId) annotations["otel.trace_id"] = traceId
          if (spanId) annotations["otel.span_id"] = spanId
          annotations["otel.log.severity_number"] = severity
          if (severityText) annotations["otel.log.severity_text"] = severityText
          if (eventName) annotations["otel.log.event_name"] = eventName
          if (body !== undefined && typeof body !== "string") annotations["otel.log.body"] = body
          const flags = fixed32Value(input, "flags", 8)
          if (flags !== undefined) annotations["otel.log.flags"] = flags
          const dropped = varintValue(input, "droppedAttributesCount", 7)
          if (dropped && dropped > 0n) annotations["otel.log.dropped_attributes_count"] = Number(dropped)
          const messageText = body === undefined
            ? eventName ?? ""
            : typeof body === "string"
            ? body
            : JSON.stringify(body)

          values.push({
            id: Unique.snowflake(),
            timestamp,
            level: logLevel(severity, severityText),
            message: messageText,
            fiberId: validId(traceId, 32)
              ? `otlp:${traceId}`
              : `otlp:${String(resource.attributes["service.name"] ?? scope.name ?? "unknown")}`,
            cause: typeof recordAttributes["exception.stacktrace"] === "string"
              ? recordAttributes["exception.stacktrace"]
              : typeof recordAttributes["exception.message"] === "string"
              ? recordAttributes["exception.message"]
              : undefined,
            spans: [],
            annotations,
            resource,
            instrumentationScope: scope,
          })
        }
      }
    }
    return { values, rejected: 0 }
  })
}

function tagValue(value: unknown): string {
  if (typeof value === "string") return value
  if (value === undefined) return "undefined"
  return typeof value === "number" || typeof value === "boolean"
    ? String(value)
    : JSON.stringify(value)
}

function metricTags(
  pointAttributes: Record<string, unknown>,
  metadata: Record<string, unknown>,
  description: string | undefined,
  unit: string | undefined,
): Array<{ key: string; value: string }> {
  const tags = new Map<string, string>()
  for (const [key, value] of Object.entries(metadata)) {
    tags.set(`otel.metric.metadata.${key}`, tagValue(value))
  }
  if (description) tags.set("otel.metric.description", description)
  if (unit) tags.set("otel.metric.unit", unit)
  for (const [key, value] of Object.entries(pointAttributes)) tags.set(key, tagValue(value))
  return Array.from(tags, ([key, value]) => ({ key, value }))
}

function metricTimestamp(input: Input): number {
  const timestamp = fixed64Value(input, "timeUnixNano", 3) ?? 0n
  return timestamp > 0n ? Number(timestamp / 1_000_000n) : Date.now()
}

function metricPointTags(
  input: Input,
  tags: Array<{ key: string; value: string }>,
  exemplarField: number | undefined,
  flagsField: number,
  path: Path,
): Effect.Effect<void, ParseResult.ParseError> {
  return Effect.gen(function*() {
    const startTime = fixed64Value(input, "startTimeUnixNano", 2)
    const flags = varintValue(input, "flags", flagsField)
    if (startTime !== undefined) {
      tags.push({ key: "otel.metric.start_time_unix_nano", value: startTime.toString() })
    }
    if (flags !== undefined) tags.push({ key: "otel.metric.flags", value: flags.toString() })
    if (exemplarField === undefined) return
    const exemplarValues = yield* messages(input, "exemplars", exemplarField, path)
    const exemplars = yield* Effect.forEach(exemplarValues, (exemplar, index) =>
      Effect.map(
        attributes(exemplar, "filteredAttributes", 1, [...path, "exemplars", index]),
        (filteredAttributes) => ({
          filteredAttributes,
          timeUnixNano: (fixed64Value(exemplar, "timeUnixNano", 2) ?? 0n).toString(),
          asDouble: doubleValue(exemplar, "asDouble", 3),
          asInt: signedFixed64Value(exemplar, "asInt", 6)?.toString(),
          spanId: bytesHex(exemplar, "spanId", 4),
          traceId: bytesHex(exemplar, "traceId", 5),
        }),
      ))
    if (exemplars.length > 0) {
      tags.push({ key: "otel.metric.exemplars", value: JSON.stringify(exemplars) })
    }
  })
}

function numberMetricValue(input: Input): number | undefined {
  const double = doubleValue(input, "asDouble", 4)
  if (double !== undefined) return double
  const int = signedFixed64Value(input, "asInt", 6)
  return int !== undefined ? Number(int) : undefined
}

function histogramBuckets(
  input: Input,
  jsonKey: "positive" | "negative",
  fieldNumber: 8 | 9,
  path: Path,
) {
  return Effect.gen(function*() {
    const bucketInput = yield* message(input, jsonKey, fieldNumber, path)
    if (!bucketInput) return { offset: 0, bucketCounts: [] }
    const bucketCounts = yield* packedVarints(
      bucketInput,
      "bucketCounts",
      2,
      [...path, jsonKey],
    )
    return {
      offset: sint32Value(bucketInput, "offset", 1) ?? 0,
      bucketCounts: bucketCounts.map(Number),
    }
  })
}

function parseMetrics(root: Input): Effect.Effect<Parsed<StudioStore.MetricSnapshot>, ParseResult.ParseError> {
  return Effect.gen(function*() {
    const values: Array<StudioStore.MetricSnapshot> = []
    let rejected = 0
    const resourceMetricsValues = yield* messages(root, "resourceMetrics", 1, [])
    for (let resourceIndex = 0; resourceIndex < resourceMetricsValues.length; resourceIndex++) {
      const resourceMetrics = resourceMetricsValues[resourceIndex]
      const resourcePath = ["resourceMetrics", resourceIndex] as const
      const resource = yield* resourceData(resourceMetrics, resourcePath)
      const scopeMetricsValues = yield* messages(resourceMetrics, "scopeMetrics", 2, resourcePath)
      for (let scopeIndex = 0; scopeIndex < scopeMetricsValues.length; scopeIndex++) {
        const scopeMetrics = scopeMetricsValues[scopeIndex]
        const scopePath = [...resourcePath, "scopeMetrics", scopeIndex]
        const scope = yield* scopeData(scopeMetrics, scopePath)
        const metricValues = yield* messages(scopeMetrics, "metrics", 2, scopePath)
        for (let metricIndex = 0; metricIndex < metricValues.length; metricIndex++) {
          const metric = metricValues[metricIndex]
          const metricPath = [...scopePath, "metrics", metricIndex]
          const name = stringValue(metric, "name", 1) || "unknown"
          const description = stringValue(metric, "description", 2)
          const unit = stringValue(metric, "unit", 3)
          const metadata = yield* attributes(metric, "metadata", 12, metricPath)
          const gauge = yield* message(metric, "gauge", 5, metricPath)
          const sum = yield* message(metric, "sum", 7, metricPath)
          const histogram = yield* message(metric, "histogram", 9, metricPath)
          const exponentialHistogram = yield* message(metric, "exponentialHistogram", 10, metricPath)
          const summary = yield* message(metric, "summary", 11, metricPath)

          if (gauge || sum) {
            const data = gauge ?? sum!
            const dataPath = [...metricPath, gauge ? "gauge" : "sum"]
            const monotonic = sum ? (varintValue(sum, "isMonotonic", 3) ?? 0n) !== 0n : false
            const temporality = sum ? Number(varintValue(sum, "aggregationTemporality", 2) ?? 0n) : 0
            const pointValues = yield* messages(data, "dataPoints", 1, dataPath)
            for (let pointIndex = 0; pointIndex < pointValues.length; pointIndex++) {
              const point = pointValues[pointIndex]
              const pointPath = [...dataPath, "dataPoints", pointIndex]
              const value = numberMetricValue(point)
              if (value === undefined) {
                rejected++
                continue
              }
              const pointAttributes = yield* attributes(point, "attributes", 7, pointPath)
              const tags = metricTags(pointAttributes, metadata, description, unit)
              yield* metricPointTags(point, tags, 5, 8, pointPath)
              if (temporality > 0) {
                tags.push({
                  key: "otel.metric.aggregation_temporality",
                  value: temporality === 1 ? "delta" : "cumulative",
                })
              }
              values.push({
                name,
                type: monotonic && temporality !== 1 ? "counter" : "gauge",
                value,
                tags,
                timestamp: metricTimestamp(point),
                resource,
                instrumentationScope: scope,
              })
            }
            continue
          }

          if (histogram) {
            const histogramPath = [...metricPath, "histogram"]
            const temporality = Number(varintValue(histogram, "aggregationTemporality", 2) ?? 0n)
            const pointValues = yield* messages(histogram, "dataPoints", 1, histogramPath)
            for (let pointIndex = 0; pointIndex < pointValues.length; pointIndex++) {
              const point = pointValues[pointIndex]
              const pointPath = [...histogramPath, "dataPoints", pointIndex]
              const count = Number(fixed64Value(point, "count", 4) ?? 0n)
              const sumValue = doubleValue(point, "sum", 5) ?? 0
              const average = count === 0 ? 0 : sumValue / count
              const tags = metricTags(
                yield* attributes(point, "attributes", 9, pointPath),
                metadata,
                description,
                unit,
              )
              yield* metricPointTags(point, tags, 8, 10, pointPath)
              if (temporality > 0) {
                tags.push({
                  key: "otel.metric.aggregation_temporality",
                  value: temporality === 1 ? "delta" : "cumulative",
                })
              }
              const bucketCounts = yield* packedFixed64(point, "bucketCounts", 6, pointPath)
              const explicitBounds = yield* packedDoubles(point, "explicitBounds", 7, pointPath)
              values.push({
                name,
                type: "histogram",
                value: {
                  buckets: bucketCounts.map(Number),
                  explicitBounds,
                  count,
                  sum: sumValue,
                  min: doubleValue(point, "min", 11) ?? average,
                  max: doubleValue(point, "max", 12) ?? average,
                },
                tags,
                timestamp: metricTimestamp(point),
                resource,
                instrumentationScope: scope,
              })
            }
            continue
          }

          if (exponentialHistogram) {
            const histogramPath = [...metricPath, "exponentialHistogram"]
            const temporality = Number(varintValue(exponentialHistogram, "aggregationTemporality", 2) ?? 0n)
            const pointValues = yield* messages(exponentialHistogram, "dataPoints", 1, histogramPath)
            for (let pointIndex = 0; pointIndex < pointValues.length; pointIndex++) {
              const point = pointValues[pointIndex]
              const pointPath = [...histogramPath, "dataPoints", pointIndex]
              const count = Number(fixed64Value(point, "count", 4) ?? 0n)
              const sumValue = doubleValue(point, "sum", 5) ?? 0
              const average = count === 0 ? 0 : sumValue / count
              const tags = metricTags(
                yield* attributes(point, "attributes", 1, pointPath),
                metadata,
                description,
                unit,
              )
              yield* metricPointTags(point, tags, 11, 10, pointPath)
              if (temporality > 0) {
                tags.push({
                  key: "otel.metric.aggregation_temporality",
                  value: temporality === 1 ? "delta" : "cumulative",
                })
              }
              values.push({
                name,
                type: "histogram",
                value: {
                  count,
                  sum: sumValue,
                  min: doubleValue(point, "min", 12) ?? average,
                  max: doubleValue(point, "max", 13) ?? average,
                  scale: sint32Value(point, "scale", 6) ?? 0,
                  zeroCount: Number(fixed64Value(point, "zeroCount", 7) ?? 0n),
                  zeroThreshold: doubleValue(point, "zeroThreshold", 14) ?? 0,
                  positive: yield* histogramBuckets(point, "positive", 8, pointPath),
                  negative: yield* histogramBuckets(point, "negative", 9, pointPath),
                },
                tags,
                timestamp: metricTimestamp(point),
                resource,
                instrumentationScope: scope,
              })
            }
            continue
          }

          if (summary) {
            const summaryPath = [...metricPath, "summary"]
            const pointValues = yield* messages(summary, "dataPoints", 1, summaryPath)
            for (let pointIndex = 0; pointIndex < pointValues.length; pointIndex++) {
              const point = pointValues[pointIndex]
              const pointPath = [...summaryPath, "dataPoints", pointIndex]
              const quantileValues = yield* messages(point, "quantileValues", 6, pointPath)
              const quantiles = quantileValues.map((item) => ({
                quantile: doubleValue(item, "quantile", 1) ?? 0,
                value: doubleValue(item, "value", 2) ?? 0,
              }))
              const minimum = quantiles.find((item) => item.quantile === 0)?.value
              const maximum = quantiles.find((item) => item.quantile === 1)?.value
              const tags = metricTags(
                yield* attributes(point, "attributes", 7, pointPath),
                metadata,
                description,
                unit,
              )
              yield* metricPointTags(point, tags, undefined, 8, pointPath)
              values.push({
                name,
                type: "summary",
                value: {
                  quantiles,
                  count: Number(fixed64Value(point, "count", 4) ?? 0n),
                  sum: doubleValue(point, "sum", 5) ?? 0,
                  min: minimum,
                  max: maximum,
                },
                tags,
                timestamp: metricTimestamp(point),
                resource,
                instrumentationScope: scope,
              })
            }
            continue
          }

          rejected++
        }
      }
    }
    return { values, rejected }
  })
}

function concatBytes(parts: ReadonlyArray<Uint8Array>): Uint8Array {
  const out = new Uint8Array(parts.reduce((size, part) => size + part.length, 0))
  let offset = 0
  for (const part of parts) {
    out.set(part, offset)
    offset += part.length
  }
  return out
}

function encodeVarint(value: bigint): Uint8Array {
  const out: Array<number> = []
  let remaining = value
  do {
    let byte = Number(remaining & 0x7fn)
    remaining >>= 7n
    if (remaining > 0n) byte |= 0x80
    out.push(byte)
  } while (remaining > 0n)
  return Uint8Array.from(out)
}

function lengthDelimited(fieldNumber: number, value: Uint8Array): Uint8Array {
  return concatBytes([
    encodeVarint(BigInt((fieldNumber << 3) | 2)),
    encodeVarint(BigInt(value.length)),
    value,
  ])
}

function responseBody(
  signal: OpenTelemetrySignal,
  contentType: "application/json" | "application/x-protobuf",
  rejected: number,
): Uint8Array {
  if (rejected === 0) {
    return contentType === "application/json" ? textEncoder.encode("{}") : emptyBytes
  }
  const rejectedName = signal === "traces"
    ? "rejectedSpans"
    : signal === "logs"
    ? "rejectedLogRecords"
    : "rejectedDataPoints"
  const errorMessage = `${rejected} invalid ${signal} item${rejected === 1 ? " was" : "s were"} rejected`
  if (contentType === "application/json") {
    return textEncoder.encode(JSON.stringify({
      partialSuccess: {
        [rejectedName]: String(rejected),
        errorMessage,
      },
    }))
  }
  const partial = concatBytes([
    encodeVarint(8n),
    encodeVarint(BigInt(rejected)),
    lengthDelimited(2, textEncoder.encode(errorMessage)),
  ])
  return lengthDelimited(1, partial)
}

function errorBody(
  contentType: "application/json" | "application/x-protobuf",
  status: number,
  message: string,
): Uint8Array {
  const code = status === 400 ? 3 : status === 413 ? 8 : status === 415 ? 12 : 13
  return contentType === "application/json"
    ? textEncoder.encode(JSON.stringify({ code, message }))
    : concatBytes([
      encodeVarint(8n),
      encodeVarint(BigInt(code)),
      lengthDelimited(2, textEncoder.encode(message)),
    ])
}

function requestContentType(request: Request): "application/json" | "application/x-protobuf" | undefined {
  const contentType = request.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase()
  if (contentType === "application/json" || contentType === "application/x-protobuf") {
    return contentType
  }
  return undefined
}

function readRequest(request: Request) {
  return Effect.gen(function*() {
    const contentLength = Number(request.headers.get("content-length"))
    if (Number.isFinite(contentLength) && contentLength > MAX_REQUEST_BYTES) {
      return yield* Effect.fail(protocolError(413, "OTLP request exceeds the 64 MiB limit"))
    }
    const contentEncoding = request.headers.get("content-encoding")?.trim().toLowerCase()
    if (contentEncoding && contentEncoding !== "identity" && contentEncoding !== "gzip") {
      return yield* Effect.fail(protocolError(415, `Unsupported content encoding: ${contentEncoding}`))
    }

    const accumulator = request.body === null
      ? { chunks: [] as Array<Uint8Array>, size: 0 }
      : yield* Stream
        .fromReadableStream({
          evaluate: () => request.body!,
          onError: (cause) => parseError("request body stream", `Unable to read OTLP request: ${String(cause)}`),
        })
        .pipe(Stream.runFoldEffect({ chunks: [] as Array<Uint8Array>, size: 0 }, (accumulator, chunk) => {
          accumulator.size += chunk.length
          accumulator.chunks.push(chunk)
          return accumulator.size > MAX_REQUEST_BYTES
            ? Effect.fail(protocolError(413, "OTLP request exceeds the 64 MiB limit"))
            : Effect.succeed(accumulator)
        }))
    let bytes = concatBytes(accumulator.chunks)
    if (contentEncoding === "gzip") {
      bytes = yield* Effect.try({
        try: () => NZlib.gunzipSync(bytes, { maxOutputLength: MAX_REQUEST_BYTES }),
        catch: (cause): ProtocolError | ParseResult.ParseError =>
          asObject(cause)?.code === "ERR_BUFFER_TOO_LARGE"
            ? protocolError(413, "OTLP request exceeds the 64 MiB limit")
            : parseError("gzip body", `Unable to decompress OTLP request: ${String(cause)}`),
      })
    }
    return bytes
  })
}

function parseRequest(
  bytes: Uint8Array,
  contentType: "application/json" | "application/x-protobuf",
): Effect.Effect<Input, ParseResult.ParseError> {
  if (contentType === "application/x-protobuf") {
    return decodeMessage(bytes, [])
  }
  return Effect
    .try({
      try: () => JSON.parse(textDecoder.decode(bytes)),
      catch: (cause) => parseError("JSON body", `Malformed OTLP JSON: ${String(cause)}`),
    })
    .pipe(Effect.flatMap((parsed) => {
      const object = asObject(parsed)
      return object
        ? Effect.succeed(object)
        : Effect.fail(parseError(typeof parsed, "Malformed OTLP JSON: root must be an object"))
    }))
}

function persist(signal: OpenTelemetrySignal, input: Input) {
  return Effect
    .gen(function*() {
      const studio = yield* Studio.Studio
      const sql = yield* SqlClient.SqlClient
      if (signal === "traces") {
        const parsed = yield* parseTraces(input)
        yield* sql.withTransaction(
          Effect.gen(function*() {
            yield* Effect.forEach(parsed.values, StudioStore.insertSpan, { discard: true })
            yield* StudioStore.evictSpans(studio.store.spanCapacity)
          }),
        )
        const traceIds = new Set<string>()
        for (const span of parsed.values) {
          traceIds.add(span.traceId)
          yield* PubSub.publish(studio.store.events, { _tag: "SpanStart", span })
          if (span.endTime !== undefined) {
            yield* PubSub.publish(studio.store.events, { _tag: "SpanEnd", span })
          }
        }
        for (const traceId of traceIds) {
          yield* PubSub.publish(studio.store.events, { _tag: "TraceEnd", traceId })
        }
        return parsed.rejected
      }
      if (signal === "logs") {
        const parsed = yield* parseLogs(input)
        yield* sql.withTransaction(
          Effect.gen(function*() {
            yield* Effect.forEach(parsed.values, StudioStore.insertLog, { discard: true })
            yield* StudioStore.evict("Log", studio.store.logCapacity)
          }),
        )
        yield* Effect.forEach(
          parsed.values,
          (log) => PubSub.publish(studio.store.events, { _tag: "Log", log }),
          { discard: true },
        )
        return parsed.rejected
      }

      const parsed = yield* parseMetrics(input)
      yield* sql.withTransaction(
        Effect.gen(function*() {
          yield* StudioStore.insertMetrics(parsed.values)
          yield* StudioStore.evict("MetricSample", METRIC_CAPACITY)
        }),
      )
      if (parsed.values.length > 0) {
        yield* PubSub.publish(studio.store.events, {
          _tag: "MetricsSnapshot",
          metrics: parsed.values,
        })
      }
      return parsed.rejected
    })
    .pipe(Effect.withTracerEnabled(false))
}

export function handle(signal: OpenTelemetrySignal) {
  return Effect
    .gen(function*() {
      const request = yield* Route.Request
      const contentType = requestContentType(request)
      if (contentType === undefined) {
        return yield* Effect.fail(protocolError(415, "OTLP requires application/json or application/x-protobuf"))
      }
      const bytes = yield* readRequest(request)
      const input = yield* parseRequest(bytes, contentType)
      const rejected = yield* persist(signal, input)
      return Entity.make(responseBody(signal, contentType, rejected), {
        status: 200,
        headers: { "content-type": contentType },
      })
    })
    .pipe(
      Effect.catchAll((cause) => {
        const status = ParseResult.isParseError(cause)
          ? 400
          : asObject(cause)?._tag === "ProtocolError"
          ? (cause as ProtocolError).status
          : 500
        const message = ParseResult.isParseError(cause)
          ? String(cause)
          : asObject(cause)?._tag === "ProtocolError"
          ? (cause as ProtocolError).message
          : "Unable to persist OTLP telemetry"
        return Effect.map(Route.Request, (request) => {
          const contentType = requestContentType(request) ?? "application/json"
          return Entity.make(errorBody(contentType, status, message), {
            status,
            headers: { "content-type": contentType },
          })
        })
      }),
    )
}
