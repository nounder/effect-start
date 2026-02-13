import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Metric from "effect/Metric"
import * as MetricKeyType from "effect/MetricKeyType"
import * as PubSub from "effect/PubSub"
import * as Schedule from "effect/Schedule"
import * as TowerStore from "./TowerStore.ts"

export const layer: Layer.Layer<never, never, TowerStore.TowerStore> = Layer.scopedDiscard(
  Effect.gen(function* () {
    const store = yield* TowerStore.TowerStore

    yield* Effect.forkScoped(
      Effect.schedule(
        Effect.sync(() => {
          const pairs = Metric.unsafeSnapshot()
          const snapshots: Array<TowerStore.TowerMetricSnapshot> = []

          for (const pair of pairs) {
            const key = pair.metricKey
            const state = pair.metricState as any
            let type: TowerStore.TowerMetricSnapshot["type"] = "counter"
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
              timestamp: Date.now(),
            })
          }

          store.metrics = snapshots
          Effect.runSync(
            PubSub.publish(store.events, { _tag: "MetricsSnapshot", metrics: snapshots }),
          )
        }),
        Schedule.spaced("2 seconds"),
      ),
    )
  }),
)
