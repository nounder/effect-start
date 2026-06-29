import * as Unique from "../Unique.ts"

export interface Span {
  readonly spanId: bigint
  readonly traceId: bigint
  readonly fiberId: string | undefined
  readonly name: string
  readonly kind: string
  readonly parentSpanId: bigint | undefined
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

export const nextSpanId = () => nextPackedId()

export const nextTraceId = () => nextPackedId()
