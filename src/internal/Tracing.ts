import * as Unique from "../Unique.ts"

export interface Span {
  readonly spanId: string
  readonly traceId: string
  readonly fiberId: string | undefined
  readonly name: string
  readonly kind: string
  readonly parentSpanId: string | undefined
  startTime: bigint
  endTime: bigint | undefined
  durationMs: number | undefined
  status: "started" | "ok" | "error"
  readonly attributes: Record<string, unknown>
  readonly events: Array<
    { name: string; startTime: bigint; attributes?: Record<string, unknown> }
  >
}

export const nextPackedId = (): bigint => Unique.snowflake()

export const nextSpanId = (): string => nextPackedId().toString()

export const nextTraceId = (): string => nextPackedId().toString()
