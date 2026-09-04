import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Metric from "effect/Metric"
import * as PubSub from "effect/PubSub"
import * as Schedule from "effect/Schedule"
import type * as SqlClient from "effect/unstable/sql/SqlClient"
import * as StudioContext from "./internal/StudioContext.ts"
import * as StudioStore from "./StudioStore.ts"

const PERIOD_MS = 2000
const SAMPLE_CAPACITY = 50_000

export const layer: Layer.Layer<
  never,
  never,
  StudioContext.Studio | SqlClient.SqlClient
> = Layer
  .effectDiscard(
    Effect.gen(function*() {
      const { store } = yield* StudioContext.Studio

      const tick = Effect.gen(function*() {
        const timestamp = Math.floor(Date.now() / PERIOD_MS) * PERIOD_MS
        const pairs = yield* Metric.snapshot
        const snapshots: Array<StudioStore.MetricSnapshot> = []

        for (const pair of pairs) {
          let type: StudioStore.MetricSnapshot["type"] = "counter"
          let value: unknown = 0

          if (pair.type === "Counter") {
            type = "counter"
            value = pair.state.count
          } else if (pair.type === "Gauge") {
            type = "gauge"
            value = pair.state.value
          } else if (pair.type === "Histogram") {
            type = "histogram"
            value = {
              buckets: pair.state.buckets,
              count: pair.state.count,
              sum: pair.state.sum,
              min: pair.state.min,
              max: pair.state.max,
            }
          } else if (pair.type === "Frequency") {
            type = "frequency"
            value = Object.fromEntries(pair.state.occurrences)
          } else if (pair.type === "Summary") {
            type = "summary"
            value = {
              quantiles: pair.state.quantiles,
              count: pair.state.count,
              sum: pair.state.sum,
              min: pair.state.min,
              max: pair.state.max,
            }
          }

          snapshots.push({
            name: pair.id,
            type,
            value,
            tags: pair.attributes === undefined
              ? []
              : Object.entries(pair.attributes).map(([key, value]) => ({ key, value: String(value) })),
            timestamp,
          })
        }

        yield* StudioStore.insertMetrics(snapshots)
        yield* StudioStore.evict("MetricSample", SAMPLE_CAPACITY)
        yield* PubSub.publish(store.events, {
          _tag: "MetricsSnapshot",
          metrics: snapshots,
        })
      })

      yield* Effect.forkScoped(
        Effect.schedule(tick, Schedule.windowed(`${PERIOD_MS} millis`)),
      )
    }),
  )
