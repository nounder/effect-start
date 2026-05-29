import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Metric from "effect/Metric"
import * as MetricKeyType from "effect/MetricKeyType"
import * as PubSub from "effect/PubSub"
import * as Schedule from "effect/Schedule"
import type * as SqlClient from "../sql/SqlClient.ts"
import * as Studio from "./Studio.ts"
import * as StudioStore from "./StudioStore.ts"

const PERIOD_MS = 2000
const SAMPLE_CAPACITY = 50_000

export const layer: Layer.Layer<
  never,
  never,
  Studio.Studio | SqlClient.SqlClient
> = Layer
  .scopedDiscard(
    Effect.gen(function*() {
      const { store } = yield* Studio.Studio

      const tick = Effect.gen(function*() {
        const timestamp = Math.floor(Date.now() / PERIOD_MS) * PERIOD_MS
        const pairs = Metric.unsafeSnapshot()
        const snapshots: Array<StudioStore.MetricSnapshot> = []

        for (const pair of pairs) {
          const key = pair.metricKey
          const state = pair.metricState as any
          let type: StudioStore.MetricSnapshot["type"] = "counter"
          let value: unknown = 0

          if (MetricKeyType.CounterKeyTypeTypeId in key.keyType) {
            type = "counter"
            value = state.count
          } else if (MetricKeyType.GaugeKeyTypeTypeId in key.keyType) {
            type = "gauge"
            value = state.value
          } else if (MetricKeyType.HistogramKeyTypeTypeId in key.keyType) {
            type = "histogram"
            value = {
              buckets: state.buckets,
              count: state.count,
              sum: state.sum,
              min: state.min,
              max: state.max,
            }
          } else if (MetricKeyType.FrequencyKeyTypeTypeId in key.keyType) {
            type = "frequency"
            value = Object.fromEntries(state.occurrences)
          } else if (MetricKeyType.SummaryKeyTypeTypeId in key.keyType) {
            type = "summary"
            value = {
              quantiles: state.quantiles,
              count: state.count,
              sum: state.sum,
              min: state.min,
              max: state.max,
            }
          }

          snapshots.push({
            name: key.name,
            type,
            value,
            tags: key.tags.map((t: any) => ({ key: t.key, value: t.value })),
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
