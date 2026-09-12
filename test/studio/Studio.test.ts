import * as test from "bun:test"
import * as Bundle from "effect-start/bundler/Bundle"
import * as Start from "effect-start/Start"
import * as Studio from "effect-start/studio/Studio"
import * as StudioStore from "effect-start/studio/StudioStore"
import * as Data from "effect/Data"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as FetchHttpClient from "effect/unstable/http/FetchHttpClient"
import * as HttpClient from "effect/unstable/http/HttpClient"
import * as HttpServer from "effect/unstable/http/HttpServer"
import * as SqlClient from "effect/unstable/sql/SqlClient"
import { JSDOM } from "jsdom"
import * as BunServer from "../../src/bun/BunServer.ts"
import * as Route from "../../src/Route.ts"

const studioLayer = Start.pack(
  Studio.layer(),
  Layer.succeed(Bundle.Bundle, Bundle.emptyBundleContext),
)

test.it("persists every request span and exposes the complete trace in Studio's API and UI", () =>
  Effect
    .gen(function*() {
      const server = yield* HttpServer.HttpServer

      test
        .expect(server.address._tag)
        .toBe("TcpAddress")

      if (server.address._tag !== "TcpAddress") return yield* Effect.die("Expected a TCP server")
      const base = `http://127.0.0.1:${server.address.port}`
      const client = (yield* HttpClient.HttpClient).pipe(
        HttpClient.transformResponse(Effect.provideService(HttpClient.TracerDisabledWhen, () => true)),
      )
      const response = yield* client.get(`${base}/widgets`, { headers: { accept: "application/json" } })

      test
        .expect(response.status)
        .toBe(200)

      const result = (yield* response.json) as { traceId: string; spanId: string; widget: string }

      test
        .expect(result.widget)
        .toBe("fabricated widget")
      test
        .expect(result.traceId)
        .toBeString()

      const otherResponse = yield* client.get(`${base}/widgets`, { headers: { accept: "application/json" } })

      test
        .expect(otherResponse.status)
        .toBe(200)

      const other = (yield* otherResponse.json) as { traceId: string; spanId: string }

      test
        .expect(other.traceId)
        .not
        .toBe(result.traceId)

      const traceUrl = `${base}/studio/traces/${result.traceId}`
      const traceResponse = yield* client.get(traceUrl, { headers: { accept: "application/json" } })

      test
        .expect(traceResponse.status)
        .toBe(200)

      const trace: unknown = yield* traceResponse.json
      const spans = yield* StudioStore.spansByTraceId(result.traceId)

      test
        .expect(spans.map((span) => span.name))
        .toEqual([
          "http.server GET",
          "widgets.route",
          "widgets.load",
          "widgets.decode",
          "widgets.cache",
        ])

      const root = spans[0]!

      test
        .expect(response.headers["server-timing"])
        .toBe(`trace;desc=00-${result.traceId}-${root.spanId}-01`)
      test
        .expect(spans.map((span) => span.parentSpanId))
        .toEqual([
          undefined,
          root.spanId,
          result.spanId,
          spans[2]!.spanId,
          result.spanId,
        ])
      test
        .expect(spans[1]!.spanId)
        .toBe(result.spanId)
      test
        .expect(root.kind)
        .toBe("server")
      test
        .expect(root.attributes)
        .toMatchObject({
          "http.request.method": "GET",
          "url.path": "/widgets",
          "http.response.status_code": 200,
        })
      test
        .expect(spans[2]!.attributes)
        .toMatchObject({ "widget.id": "fixture-42" })
      test
        .expect(spans[2]!.events)
        .toEqual([{
          name: "widget.loaded",
          startTime: spans[2]!.startTime,
          attributes: { source: "fabricated database" },
        }])

      for (const span of spans) {
        test
          .expect(span.traceId)
          .toBe(result.traceId)
        test
          .expect(span.status)
          .toBe(span.name === "widgets.cache" ? "error" : "ok")
        test
          .expect(span.endTime)
          .toBeGreaterThanOrEqual(span.startTime)
        test
          .expect(span.durationMs)
          .toBeGreaterThanOrEqual(0)
      }

      test
        .expect(trace)
        .toEqual({
          traceId: result.traceId,
          spans: spans.map((span) => ({
            ...span,
            startTime: String(span.startTime),
            endTime: String(span.endTime),
            events: span.events.map((event) => ({ ...event, startTime: String(event.startTime) })),
          })),
          logs: [],
        })

      const listResponse = yield* client.get(`${base}/studio/traces`, { headers: { accept: "text/html" } })

      test
        .expect(listResponse.status)
        .toBe(200)

      const list = new JSDOM(yield* listResponse.text).window.document

      test
        .expect(list.querySelector(`#trace-${result.traceId}`)?.getAttribute("href"))
        .toBe(`/studio/traces/${result.traceId}`)

      const pageResponse = yield* client.get(traceUrl, { headers: { accept: "text/html" } })

      test
        .expect(pageResponse.status)
        .toBe(200)

      const page = new JSDOM(yield* pageResponse.text).window.document
      const rows = Array.from(page.querySelectorAll("#trace-detail .wf-row"))

      test
        .expect(rows)
        .toHaveLength(spans.length)
      test
        .expect(page.querySelectorAll("#trace-detail .wf-popover"))
        .toHaveLength(spans.length)
      test
        .expect(page.getElementById(`wf-pop-${other.spanId}`))
        .toBeNull()

      for (const span of spans) {
        test
          .expect(rows.filter((row) => row.querySelector(".wf-name")?.textContent?.includes(span.name)))
          .toHaveLength(1)

        const detail = page.getElementById(`wf-pop-${span.spanId}`)

        test
          .expect(detail?.textContent)
          .toContain(span.spanId)

        if (span.parentSpanId) {
          test
            .expect(detail?.textContent)
            .toContain(span.parentSpanId)
        }
      }
      const loadDetail = page.getElementById(`wf-pop-${spans[2]!.spanId}`)

      test
        .expect(loadDetail?.textContent)
        .toContain("fixture-42")
      test
        .expect(loadDetail?.textContent)
        .toContain("widget.loaded")
      test
        .expect(loadDetail?.textContent)
        .toContain("fabricated database")
    })
    .pipe(
      Effect.provide(Start.build(
        BunServer.layerRoutes({ port: 0, hostname: "127.0.0.1" }),
        Route.layerMerge({
          "/widgets": Route.get(Route.json(
            Effect
              .gen(function*() {
                const span = yield* Effect.currentSpan
                const widget = yield* Effect
                  .gen(function*() {
                    const load = yield* Effect.currentSpan
                    yield* Effect.annotateCurrentSpan("widget.id", "fixture-42")
                    load.event("widget.loaded", load.status.startTime, { source: "fabricated database" })
                    return yield* Effect.succeed("fabricated widget").pipe(Effect.withSpan("widgets.decode"))
                  })
                  .pipe(Effect.withSpan("widgets.load"))
                yield* Effect.fail("fabricated cache failure").pipe(
                  Effect.withSpan("widgets.cache"),
                  Effect.exit,
                )
                return { traceId: span.traceId, spanId: span.spanId, widget }
              })
              .pipe(Effect.withSpan("widgets.route")),
          )),
        }),
        studioLayer,
      )),
      Effect.provide(FetchHttpClient.layer),
      Effect.scoped,
      Effect.runPromise,
    ))

test.it("flushes queued telemetry writes when its scope closes", () => {
  let completed = false

  return Effect
    .gen(function*() {
      const studio = yield* Studio.Studio
      StudioStore.runWrite(
        studio.store,
        Effect.andThen(
          Effect.sleep("20 millis"),
          Effect.sync(() => {
            completed = true
          }),
        ),
      )
    })
    .pipe(
      Effect.provide(studioLayer),
      Effect.andThen(Effect.sync(() => {
        test
          .expect(completed)
          .toBe(true)
      })),
      Effect.runPromise,
    )
})

test.it("retains tags and serializable properties for traced failures", () => {
  class StudioTracerTestError extends Data.TaggedError("StudioTracerTestError")<{
    readonly resource: string
    readonly attempt: bigint
  }> {}

  return Effect
    .gen(function*() {
      yield* Effect.fail(new StudioTracerTestError({ resource: "widget", attempt: 2n })).pipe(
        Effect.withSpan("studio.test.failure"),
        Effect.exit,
      )
      yield* StudioStore.flushWrites()

      const sql = yield* SqlClient.SqlClient
      const rows = yield* sql<StudioStore.ErrorRow>`
        SELECT * FROM Error
        WHERE details LIKE ${"%StudioTracerTestError%"}
        ORDER BY rowid DESC
        LIMIT 1
      `
      const detail = StudioStore.deserializeError(rows[0]!).details[0]!

      test
        .expect(detail)
        .toEqual({
          kind: "fail",
          tag: "StudioTracerTestError",
          message: "StudioTracerTestError",
          properties: {
            resource: "widget",
            attempt: "2n",
          },
          span: "studio.test.failure",
        })
    })
    .pipe(
      Effect.provide(studioLayer),
      Effect.runPromise,
    )
})
