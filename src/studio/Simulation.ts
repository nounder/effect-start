import * as Data from "effect/Data"
import * as Duration from "effect/Duration"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Metric from "effect/Metric"
import * as MetricBoundaries from "effect/MetricBoundaries"
import * as Random from "effect/Random"
import * as Schedule from "effect/Schedule"

const pick = <T>(arr: ReadonlyArray<T>): Effect.Effect<T> =>
  Random.nextIntBetween(0, arr.length).pipe(Effect.map((i) => arr[i]))

const randomMs = (min: number, max: number) =>
  Random.nextIntBetween(min, max).pipe(Effect.map((ms) => Duration.millis(ms)))

const maybe = (pct: number, op: Effect.Effect<void, any>) =>
  Effect.gen(function* () {
    if ((yield* Random.nextIntBetween(0, 100)) < pct) yield* op
  })

const httpRequestsTotal = Metric.counter("http.requests.total")
const httpRequestDuration = Metric.histogram(
  "http.request.duration_ms",
  MetricBoundaries.linear({ start: 0, width: 50, count: 20 }),
)
const activeConnections = Metric.gauge("http.active_connections")
const dbQueryDuration = Metric.histogram(
  "db.query.duration_ms",
  MetricBoundaries.linear({ start: 0, width: 10, count: 25 }),
)
const dbPoolSize = Metric.gauge("db.pool.active")
const cacheHits = Metric.counter("cache.hits")
const cacheMisses = Metric.counter("cache.misses")
const queueDepth = Metric.gauge("queue.depth")
const eventCount = Metric.counter("events.processed")
const retryCount = Metric.counter("retry.total")
const circuitBreakerTrips = Metric.counter("circuit_breaker.trips")
const rateLimitRejections = Metric.counter("rate_limit.rejections")
const serializationDuration = Metric.histogram(
  "serialization.duration_ms",
  MetricBoundaries.linear({ start: 0, width: 5, count: 15 }),
)

const routes = [
  { method: "GET", path: "/api/users", handler: "UserController.list" },
  { method: "GET", path: "/api/users/:id", handler: "UserController.get" },
  { method: "POST", path: "/api/users", handler: "UserController.create" },
  { method: "PUT", path: "/api/users/:id", handler: "UserController.update" },
  { method: "DELETE", path: "/api/users/:id", handler: "UserController.delete" },
  { method: "GET", path: "/api/products", handler: "ProductController.list" },
  { method: "GET", path: "/api/products/:id", handler: "ProductController.get" },
  { method: "POST", path: "/api/orders", handler: "OrderController.create" },
  { method: "GET", path: "/api/orders/:id", handler: "OrderController.get" },
  { method: "PATCH", path: "/api/orders/:id/status", handler: "OrderController.updateStatus" },
  { method: "POST", path: "/api/auth/login", handler: "AuthController.login" },
  { method: "POST", path: "/api/auth/refresh", handler: "AuthController.refresh" },
  { method: "POST", path: "/api/auth/logout", handler: "AuthController.logout" },
  { method: "GET", path: "/api/search", handler: "SearchController.query" },
  { method: "GET", path: "/api/analytics/dashboard", handler: "AnalyticsController.dashboard" },
  { method: "POST", path: "/api/notifications/send", handler: "NotificationController.send" },
  { method: "POST", path: "/api/uploads/image", handler: "UploadController.image" },
  { method: "GET", path: "/api/health", handler: "HealthController.check" },
  { method: "GET", path: "/api/config", handler: "ConfigController.get" },
  { method: "POST", path: "/api/webhooks/stripe", handler: "WebhookController.stripe" },
] as const

const dbQueries = [
  "SELECT * FROM users WHERE id = $1",
  "SELECT * FROM users ORDER BY created_at DESC LIMIT 20",
  "INSERT INTO users (name, email) VALUES ($1, $2) RETURNING *",
  "UPDATE users SET name = $1 WHERE id = $2",
  "SELECT p.*, c.name AS category FROM products p JOIN categories c ON p.category_id = c.id",
  "SELECT * FROM orders WHERE user_id = $1 ORDER BY created_at DESC",
  "INSERT INTO orders (user_id, total, status) VALUES ($1, $2, $3)",
  "SELECT u.*, COUNT(o.id) AS order_count FROM users u LEFT JOIN orders o ON u.id = o.id GROUP BY u.id",
  "DELETE FROM sessions WHERE expires_at < NOW()",
  "SELECT * FROM products WHERE tsv @@ plainto_tsquery($1) LIMIT 50",
  "SELECT o.*, json_agg(oi.*) AS items FROM orders o JOIN order_items oi ON o.id = oi.order_id WHERE o.id = $1 GROUP BY o.id",
  "WITH ranked AS (SELECT *, ROW_NUMBER() OVER (PARTITION BY category_id ORDER BY sales DESC) rn FROM products) SELECT * FROM ranked WHERE rn <= 5",
  "UPDATE inventory SET quantity = quantity - $1 WHERE product_id = $2 AND quantity >= $1 RETURNING quantity",
]

const cacheKeys = [
  "user:profile:42",
  "user:profile:108",
  "product:listing:page:1",
  "product:detail:77",
  "session:abc123",
  "rate_limit:192.168.1.1",
  "search:results:shoes",
  "config:feature_flags",
  "analytics:dashboard:daily",
  "inventory:stock:sku_4421",
  "cart:user:42",
]

const errorMessages = [
  "connection refused: upstream timeout after 30s",
  "UNIQUE constraint failed: users.email",
  "rate limit exceeded for client 10.0.3.44",
  "invalid JWT: token expired at 2025-12-01T00:00:00Z",
  "payment gateway returned 502",
  "deadlock detected on table orders",
  "request body exceeds 10MB limit",
  "foreign key constraint: order references missing user",
  "TLS handshake timeout with payment-service:443",
  "DNS resolution failed for analytics.internal.svc",
]

class DatabaseError extends Data.TaggedError("DatabaseError")<{
  readonly query: string
  readonly reason: string
}> {}

class AuthenticationError extends Data.TaggedError("AuthenticationError")<{
  readonly reason: string
  readonly userId?: string
}> {}

class ExternalServiceError extends Data.TaggedError("ExternalServiceError")<{
  readonly service: string
  readonly statusCode: number
  readonly reason: string
}> {}

class TimeoutError extends Data.TaggedError("TimeoutError")<{
  readonly operation: string
  readonly durationMs: number
}> {}

class ValidationError extends Data.TaggedError("ValidationError")<{
  readonly field: string
  readonly message: string
}> {}

class TaskError extends Data.TaggedError("TaskError")<{
  readonly task: string
  readonly reason: string
}> {}

class HttpError extends Data.TaggedError("HttpError")<{
  readonly method: string
  readonly path: string
  readonly statusCode: number
  readonly message: string
}> {}

class RateLimitError extends Data.TaggedError("RateLimitError")<{
  readonly clientIp: string
  readonly limit: number
}> {}

class CircuitBreakerError extends Data.TaggedError("CircuitBreakerError")<{
  readonly service: string
  readonly failureCount: number
}> {}

const simulateDnsResolve = Effect.gen(function* () {
  const hosts = [
    "db-primary.internal",
    "cache-01.internal",
    "payment-service.prod",
    "queue.internal",
    "analytics.internal.svc",
  ]
  const host = yield* pick(hosts)
  yield* Effect.annotateCurrentSpan("dns.host", host)
  yield* Effect.sleep(yield* randomMs(0, 5))
  if ((yield* Random.nextIntBetween(0, 100)) < 2) {
    return yield* Effect.fail(
      new TimeoutError({ operation: `dns.resolve(${host})`, durationMs: 5000 }),
    )
  }
}).pipe(Effect.withSpan("dns.resolve"))

const simulateTlsHandshake = Effect.gen(function* () {
  yield* Effect.sleep(yield* randomMs(2, 20))
  yield* Effect.annotateCurrentSpan("tls.version", "1.3")
  yield* Effect.annotateCurrentSpan("tls.cipher", "TLS_AES_256_GCM_SHA384")
  if ((yield* Random.nextIntBetween(0, 100)) < 1) {
    return yield* Effect.fail(new TimeoutError({ operation: "tls.handshake", durationMs: 10000 }))
  }
}).pipe(Effect.withSpan("tls.handshake"))

const simulateConnectionPoolAcquire = Effect.gen(function* () {
  const pool = yield* Random.nextIntBetween(1, 20)
  const maxPool = 20
  yield* Effect.annotateCurrentSpan("pool.active", pool)
  yield* Effect.annotateCurrentSpan("pool.max", maxPool)
  yield* dbPoolSize.pipe(Metric.set(pool))
  yield* Effect.sleep(yield* randomMs(0, pool > 15 ? 50 : 5))
  if (pool >= 19 && (yield* Random.nextIntBetween(0, 100)) < 30) {
    return yield* Effect.die(new DatabaseError({ query: "", reason: "connection pool exhausted" }))
  }
}).pipe(Effect.withSpan("db.pool.acquire"))

const simulateConnectionPoolRelease = Effect.gen(function* () {
  yield* Effect.sleep(yield* randomMs(0, 1))
}).pipe(Effect.withSpan("db.pool.release"))

const simulateQueryParse = Effect.gen(function* () {
  yield* Effect.sleep(yield* randomMs(0, 3))
  yield* Effect.annotateCurrentSpan("db.parse.cached", (yield* Random.nextIntBetween(0, 100)) < 80)
}).pipe(Effect.withSpan("db.query.parse"))

const simulateQueryExecute = Effect.gen(function* () {
  const query = yield* pick(dbQueries)
  const delay = yield* randomMs(1, 80)
  yield* Effect.annotateCurrentSpan("db.statement", query)
  yield* Metric.update(dbQueryDuration, Math.round(Duration.toMillis(delay)))
  yield* Effect.sleep(delay)
  const roll = yield* Random.nextIntBetween(0, 100)
  if (roll < 2) {
    return yield* Effect.fail(
      new DatabaseError({ query, reason: "deadlock detected on table orders" }),
    )
  }
  if (roll < 4) {
    return yield* Effect.fail(
      new TimeoutError({
        operation: "db.query.execute",
        durationMs: Math.round(Duration.toMillis(delay)),
      }),
    )
  }
}).pipe(Effect.withSpan("db.query.execute"))

const simulateResultDeserialization = Effect.gen(function* () {
  const rowCount = yield* Random.nextIntBetween(0, 500)
  yield* Effect.annotateCurrentSpan("db.rows", rowCount)
  yield* Effect.sleep(yield* randomMs(0, rowCount > 100 ? 15 : 3))
}).pipe(Effect.withSpan("db.result.deserialize"))

const simulateDbQuery = Effect.gen(function* () {
  yield* simulateConnectionPoolAcquire
  yield* simulateQueryParse
  yield* simulateQueryExecute
  yield* simulateResultDeserialization
  yield* simulateConnectionPoolRelease
}).pipe(Effect.withSpan("db.query"))

const simulateCacheSerialize = Effect.gen(function* () {
  const ms = yield* Random.nextIntBetween(0, 5)
  yield* Metric.update(serializationDuration, ms)
  yield* Effect.sleep(Duration.millis(ms))
}).pipe(Effect.withSpan("cache.serialize"))

const simulateCacheDeserialize = Effect.gen(function* () {
  const ms = yield* Random.nextIntBetween(0, 4)
  yield* Metric.update(serializationDuration, ms)
  yield* Effect.sleep(Duration.millis(ms))
}).pipe(Effect.withSpan("cache.deserialize"))

const simulateCache = Effect.gen(function* () {
  const key = yield* pick(cacheKeys)
  const hit = (yield* Random.nextIntBetween(0, 100)) < 75
  yield* Effect.annotateCurrentSpan("cache.key", key)
  yield* Effect.annotateCurrentSpan("cache.hit", hit)
  yield* Effect.sleep(yield* randomMs(0, 3))
  if (hit) {
    yield* Metric.increment(cacheHits)
    yield* simulateCacheDeserialize
    yield* Effect.logDebug(`cache hit: ${key}`)
  } else {
    yield* Metric.increment(cacheMisses)
    yield* Effect.logDebug(`cache miss: ${key}`)
  }
}).pipe(Effect.withSpan("cache.lookup"))

const simulateTokenDecode = Effect.gen(function* () {
  yield* Effect.sleep(yield* randomMs(0, 2))
  yield* Effect.annotateCurrentSpan("jwt.alg", "RS256")
}).pipe(Effect.withSpan("jwt.decode"))

const simulateTokenVerify = Effect.gen(function* () {
  yield* Effect.sleep(yield* randomMs(1, 8))
  const roll = yield* Random.nextIntBetween(0, 100)
  if (roll < 3) {
    return yield* Effect.fail(
      new AuthenticationError({ reason: "JWT expired at 2025-12-01T00:00:00Z" }),
    )
  }
  if (roll < 5) {
    return yield* Effect.fail(
      new AuthenticationError({
        reason: "invalid signature",
        userId: "user_" + (yield* Random.nextIntBetween(100, 999)),
      }),
    )
  }
}).pipe(Effect.withSpan("jwt.verify"))

const simulatePermissionCheck = Effect.gen(function* () {
  const roles = ["admin", "editor", "viewer", "moderator"]
  const role = yield* pick(roles)
  yield* Effect.annotateCurrentSpan("auth.role", role)
  yield* Effect.sleep(yield* randomMs(0, 3))
  if ((yield* Random.nextIntBetween(0, 100)) < 2) {
    return yield* Effect.fail(
      new AuthenticationError({ reason: `insufficient permissions for role: ${role}` }),
    )
  }
}).pipe(Effect.withSpan("auth.permission_check"))

const simulateAuth = Effect.gen(function* () {
  yield* simulateTokenDecode
  yield* simulateTokenVerify
  yield* simulatePermissionCheck
  yield* Effect.logDebug("token validated")
}).pipe(Effect.withSpan("auth.validate"))

const simulateRateLimit = Effect.gen(function* () {
  const ips = ["10.0.3.44", "192.168.1.1", "172.16.0.55", "10.0.7.12", "203.0.113.42"]
  const ip = yield* pick(ips)
  const remaining = yield* Random.nextIntBetween(0, 100)
  yield* Effect.annotateCurrentSpan("rate_limit.client_ip", ip)
  yield* Effect.annotateCurrentSpan("rate_limit.remaining", remaining)
  yield* Effect.sleep(yield* randomMs(0, 2))
  if (remaining < 3) {
    yield* Metric.increment(rateLimitRejections)
    yield* Effect.logWarning(`rate limit near threshold for ${ip}`)
    if ((yield* Random.nextIntBetween(0, 100)) < 40) {
      return yield* Effect.fail(new RateLimitError({ clientIp: ip, limit: 100 }))
    }
  }
}).pipe(Effect.withSpan("middleware.rate_limit"))

const simulateCors = Effect.gen(function* () {
  const origins = [
    "https://app.example.com",
    "https://admin.example.com",
    "https://mobile.example.com",
    "null",
  ]
  const origin = yield* pick(origins)
  yield* Effect.annotateCurrentSpan("cors.origin", origin)
  yield* Effect.sleep(yield* randomMs(0, 1))
  if (origin === "null") {
    yield* Effect.logWarning("CORS: rejected null origin")
  }
}).pipe(Effect.withSpan("middleware.cors"))

const simulateRequestParsing = Effect.gen(function* () {
  const contentTypes = [
    "application/json",
    "multipart/form-data",
    "application/x-www-form-urlencoded",
    "text/plain",
  ]
  const ct = yield* pick(contentTypes)
  yield* Effect.annotateCurrentSpan("http.content_type", ct)
  const bodySize = yield* Random.nextIntBetween(0, 50000)
  yield* Effect.annotateCurrentSpan("http.body_size", bodySize)
  yield* Effect.sleep(yield* randomMs(0, bodySize > 10000 ? 15 : 3))
  if (bodySize > 40000) {
    return yield* Effect.fail(
      new ValidationError({ field: "body", message: "request body exceeds 10MB limit" }),
    )
  }
  if ((yield* Random.nextIntBetween(0, 100)) < 3) {
    return yield* Effect.fail(
      new ValidationError({ field: "body", message: "malformed JSON at position 42" }),
    )
  }
}).pipe(Effect.withSpan("http.parse_body"))

const simulateInputValidation = Effect.gen(function* () {
  yield* Effect.sleep(yield* randomMs(0, 3))
  const fields = ["email", "name", "amount", "quantity", "phone", "address.zip"]
  if ((yield* Random.nextIntBetween(0, 100)) < 5) {
    const field = yield* pick(fields)
    return yield* Effect.fail(
      new ValidationError({ field, message: `invalid format for ${field}` }),
    )
  }
}).pipe(Effect.withSpan("validation.input"))

const simulateResponseSerialization = Effect.gen(function* () {
  const formats = ["json", "msgpack", "protobuf"]
  const format = yield* pick(formats)
  yield* Effect.annotateCurrentSpan("serialization.format", format)
  const ms = yield* Random.nextIntBetween(0, 10)
  yield* Metric.update(serializationDuration, ms)
  yield* Effect.sleep(Duration.millis(ms))
}).pipe(Effect.withSpan("http.serialize_response"))

const simulateCompression = Effect.gen(function* () {
  const algos = ["gzip", "br", "none"]
  const algo = yield* pick(algos)
  yield* Effect.annotateCurrentSpan("compression.algorithm", algo)
  yield* Effect.sleep(yield* randomMs(0, algo === "none" ? 1 : 8))
}).pipe(Effect.withSpan("http.compress"))

const simulateAccessLog = Effect.gen(function* () {
  yield* Effect.sleep(yield* randomMs(0, 1))
}).pipe(Effect.withSpan("middleware.access_log"))

const simulateCircuitBreaker = (inner: Effect.Effect<void, any>, service: string) =>
  Effect.gen(function* () {
    const failures = yield* Random.nextIntBetween(0, 10)
    yield* Effect.annotateCurrentSpan("circuit_breaker.service", service)
    yield* Effect.annotateCurrentSpan("circuit_breaker.failure_count", failures)
    if (failures >= 8) {
      yield* Metric.increment(circuitBreakerTrips)
      yield* Effect.logWarning(`circuit breaker OPEN for ${service}`)
      return yield* Effect.fail(new CircuitBreakerError({ service, failureCount: failures }))
    }
    yield* inner
  }).pipe(Effect.withSpan("circuit_breaker"))

const simulateRetry = (inner: Effect.Effect<void, any>, opName: string) =>
  Effect.gen(function* () {
    const maxRetries = 3
    let attempt = 0
    let succeeded = false
    while (attempt < maxRetries && !succeeded) {
      attempt++
      yield* Effect.annotateCurrentSpan("retry.attempt", attempt)
      const result = yield* inner.pipe(
        Effect.map(() => true),
        Effect.catchAll((e) => {
          if (attempt < maxRetries) {
            return Effect.gen(function* () {
              yield* Metric.increment(retryCount)
              yield* Effect.logWarning(`${opName} attempt ${attempt} failed, retrying`)
              yield* Effect.sleep(yield* randomMs(10, 50 * attempt))
              return false
            })
          }
          return Effect.fail(e)
        }),
      )
      succeeded = result
    }
  }).pipe(Effect.withSpan("retry"))

const simulateExternalCall = Effect.gen(function* () {
  const services = [
    "payment-service",
    "email-service",
    "notification-service",
    "inventory-service",
    "shipping-service",
    "tax-service",
  ]
  const service = yield* pick(services)
  yield* Effect.annotateCurrentSpan("peer.service", service)

  yield* simulateDnsResolve
  yield* simulateTlsHandshake

  const delay = yield* randomMs(10, 300)
  yield* Effect.annotateCurrentSpan(
    "http.outgoing.duration_ms",
    Math.round(Duration.toMillis(delay)),
  )
  yield* Effect.sleep(delay)

  const roll = yield* Random.nextIntBetween(0, 100)
  if (roll < 4) {
    yield* Effect.logError(`${service} responded with 503`)
    return yield* Effect.fail(
      new ExternalServiceError({ service, statusCode: 503, reason: "service unavailable" }),
    )
  }
  if (roll < 6) {
    yield* Effect.logError(`${service} timed out after ${Math.round(Duration.toMillis(delay))}ms`)
    return yield* Effect.fail(
      new TimeoutError({
        operation: `${service} call`,
        durationMs: Math.round(Duration.toMillis(delay)),
      }),
    )
  }
  if (roll < 8) {
    yield* Effect.logError(`${service} responded with 502`)
    return yield* Effect.fail(
      new ExternalServiceError({ service, statusCode: 502, reason: "bad gateway" }),
    )
  }
}).pipe(Effect.withSpan("http.outgoing"))

const simulateExternalCallWithResilience = Effect.gen(function* () {
  const service = yield* pick([
    "payment-service",
    "email-service",
    "notification-service",
    "inventory-service",
  ])
  yield* simulateCircuitBreaker(simulateRetry(simulateExternalCall, `external.${service}`), service)
}).pipe(Effect.withSpan("external.resilient_call"))

const simulateSearchQuery = Effect.gen(function* () {
  const terms = ["shoes", "laptop", "organic food", "headphones", "gift ideas"]
  const term = yield* pick(terms)
  yield* Effect.annotateCurrentSpan("search.query", term)

  yield* simulateCache

  yield* Effect.gen(function* () {
    yield* Effect.sleep(yield* randomMs(5, 40))
    yield* Effect.annotateCurrentSpan("search.engine", "elasticsearch")
    yield* Effect.annotateCurrentSpan("search.index", "products_v3")
    const hits = yield* Random.nextIntBetween(0, 200)
    yield* Effect.annotateCurrentSpan("search.hits", hits)
  }).pipe(Effect.withSpan("search.execute"))

  yield* Effect.gen(function* () {
    yield* Effect.sleep(yield* randomMs(1, 10))
    yield* Effect.annotateCurrentSpan("search.boost", "relevance+recency")
  }).pipe(Effect.withSpan("search.rank"))

  yield* Effect.gen(function* () {
    yield* Effect.sleep(yield* randomMs(0, 5))
  }).pipe(Effect.withSpan("search.highlight"))
}).pipe(Effect.withSpan("search.pipeline"))

const simulateFileUpload = Effect.gen(function* () {
  const fileSize = yield* Random.nextIntBetween(1000, 5_000_000)
  yield* Effect.annotateCurrentSpan("upload.size_bytes", fileSize)

  yield* Effect.gen(function* () {
    yield* Effect.sleep(yield* randomMs(1, 10))
    const types = ["image/jpeg", "image/png", "application/pdf", "image/webp"]
    const mime = yield* pick(types)
    yield* Effect.annotateCurrentSpan("upload.mime", mime)
    if ((yield* Random.nextIntBetween(0, 100)) < 3) {
      return yield* Effect.fail(
        new ValidationError({ field: "file", message: "unsupported mime type" }),
      )
    }
  }).pipe(Effect.withSpan("upload.validate_mime"))

  yield* Effect.gen(function* () {
    yield* Effect.sleep(yield* randomMs(0, 5))
  }).pipe(Effect.withSpan("upload.virus_scan"))

  yield* Effect.gen(function* () {
    yield* Effect.sleep(yield* randomMs(5, 50))
    yield* Effect.annotateCurrentSpan("upload.bucket", "user-uploads-prod")
  }).pipe(Effect.withSpan("upload.store_s3"))

  yield* Effect.gen(function* () {
    yield* simulateDbQuery
  }).pipe(Effect.withSpan("upload.persist_metadata"))
}).pipe(Effect.withSpan("upload.pipeline"))

const simulateOrderWorkflow = Effect.gen(function* () {
  yield* Effect.annotateCurrentSpan("order.workflow", "create")

  yield* simulateInputValidation

  yield* Effect.gen(function* () {
    yield* simulateDbQuery
    yield* Effect.sleep(yield* randomMs(1, 10))
  }).pipe(Effect.withSpan("order.check_inventory"))

  yield* Effect.gen(function* () {
    yield* simulateExternalCallWithResilience
  }).pipe(Effect.withSpan("order.process_payment"))

  yield* Effect.gen(function* () {
    yield* simulateDbQuery
  }).pipe(Effect.withSpan("order.persist"))

  yield* Effect.gen(function* () {
    yield* simulateCache
    yield* simulateCacheSerialize
  }).pipe(Effect.withSpan("order.invalidate_cache"))

  yield* Effect.gen(function* () {
    yield* Effect.sleep(yield* randomMs(1, 10))
    yield* Effect.logInfo("order confirmation email queued")
  }).pipe(Effect.withSpan("order.queue_notification"))
}).pipe(Effect.withSpan("order.workflow"))

const simulateAnalyticsPipeline = Effect.gen(function* () {
  yield* Effect.gen(function* () {
    yield* simulateDbQuery
    yield* simulateDbQuery
  }).pipe(Effect.withSpan("analytics.fetch_raw"))

  yield* Effect.gen(function* () {
    yield* Effect.sleep(yield* randomMs(5, 30))
    yield* Effect.annotateCurrentSpan("analytics.aggregation", "time_series")
  }).pipe(Effect.withSpan("analytics.aggregate"))

  yield* Effect.gen(function* () {
    yield* simulateCache
  }).pipe(Effect.withSpan("analytics.cache_result"))

  yield* Effect.gen(function* () {
    yield* Effect.sleep(yield* randomMs(2, 15))
    yield* Effect.annotateCurrentSpan("analytics.format", "dashboard_v2")
  }).pipe(Effect.withSpan("analytics.transform"))
}).pipe(Effect.withSpan("analytics.pipeline"))

const simulateBackgroundTask = Effect.gen(function* () {
  const tasks = [
    "process-webhook",
    "send-email",
    "generate-report",
    "sync-inventory",
    "cleanup-sessions",
    "rebuild-search-index",
    "process-refund",
    "generate-invoice-pdf",
    "sync-crm",
  ]
  const task = yield* pick(tasks)
  yield* Effect.logInfo(`starting background task: ${task}`)

  yield* Effect.gen(function* () {
    yield* Effect.sleep(yield* randomMs(0, 5))
    yield* Effect.annotateCurrentSpan(
      "task.priority",
      yield* pick(["low", "normal", "high", "critical"]),
    )
  }).pipe(Effect.withSpan("task.dequeue"))

  yield* Effect.gen(function* () {
    yield* simulateDbQuery
  }).pipe(Effect.withSpan("task.load_context"))

  yield* Effect.gen(function* () {
    yield* Effect.sleep(yield* randomMs(20, 300))
    const roll = yield* Random.nextIntBetween(0, 100)
    if (roll < 4) {
      return yield* Effect.fail(new TaskError({ task, reason: "execution exceeded 30s deadline" }))
    }
    if (roll < 7) {
      const err = yield* pick(errorMessages)
      yield* Effect.logError(`task ${task} failed: ${err}`)
      return yield* Effect.fail(new TaskError({ task, reason: err }))
    }
    if (roll < 9) {
      return yield* Effect.die(new TaskError({ task, reason: "out of memory" }))
    }
  }).pipe(Effect.withSpan("task.execute"))

  yield* maybe(
    60,
    Effect.gen(function* () {
      yield* simulateExternalCall
    }).pipe(Effect.withSpan("task.external_dependency")),
  )

  yield* Effect.gen(function* () {
    yield* simulateDbQuery
  }).pipe(Effect.withSpan("task.persist_result"))

  yield* Effect.gen(function* () {
    yield* Effect.sleep(yield* randomMs(0, 3))
  }).pipe(Effect.withSpan("task.ack"))

  yield* Metric.increment(eventCount)
  yield* Effect.logInfo(`completed background task: ${task}`)
}).pipe(Effect.withSpan("task.background"))

const simulateRequest = Effect.gen(function* () {
  const route = yield* pick(routes)
  const statusCodes = [200, 200, 200, 200, 200, 201, 204, 301, 400, 401, 404, 500]

  yield* Metric.increment(httpRequestsTotal)
  yield* Metric.increment(activeConnections)

  const result = yield* Effect.gen(function* () {
    yield* Effect.annotateCurrentSpan("http.method", route.method)
    yield* Effect.annotateCurrentSpan("http.route", route.path)
    yield* Effect.annotateCurrentSpan("handler", route.handler)

    // middleware chain
    yield* simulateAccessLog
    yield* simulateCors
    yield* simulateRateLimit
    yield* simulateRequestParsing

    // auth (most routes)
    yield* maybe(70, simulateAuth)

    // handler body — pick a complex workflow or simple CRUD based on the route
    const handler = route.handler
    if (handler === "OrderController.create" || handler === "OrderController.updateStatus") {
      yield* simulateOrderWorkflow
    } else if (handler === "SearchController.query") {
      yield* simulateSearchQuery
    } else if (handler === "UploadController.image") {
      yield* simulateFileUpload
    } else if (handler === "AnalyticsController.dashboard") {
      yield* simulateAnalyticsPipeline
    } else if (handler === "WebhookController.stripe") {
      yield* simulateInputValidation
      yield* simulateExternalCallWithResilience
      yield* simulateDbQuery
    } else {
      // standard CRUD
      yield* maybe(50, simulateCache)
      yield* simulateDbQuery
      yield* maybe(25, simulateExternalCall)
      yield* maybe(30, simulateDbQuery) // secondary query
    }

    // response pipeline
    yield* simulateResponseSerialization
    yield* maybe(40, simulateCompression)

    const status = yield* pick(statusCodes)
    yield* Effect.annotateCurrentSpan("http.status_code", status)

    if (status >= 500) {
      const err = yield* pick(errorMessages)
      yield* Effect.logError(`${route.method} ${route.path} → ${status}: ${err}`)
      return yield* Effect.fail(
        new HttpError({
          method: route.method,
          path: route.path,
          statusCode: status,
          message: err,
        }),
      )
    }

    if (status >= 400) {
      yield* Effect.logWarning(`${route.method} ${route.path} → ${status}`)
    } else {
      yield* Effect.logInfo(`${route.method} ${route.path} → ${status}`)
    }

    return status
  }).pipe(Effect.withSpan(`${route.method} ${route.path}`))

  yield* activeConnections.pipe(Metric.set(0))

  const durationMs = yield* Random.nextIntBetween(5, 500)
  yield* Metric.update(httpRequestDuration, durationMs)

  return result
})

const requestLoop = Effect.gen(function* () {
  yield* Effect.logInfo("simulation: request loop started")
  yield* Effect.schedule(
    Effect.gen(function* () {
      const burst = yield* Random.nextIntBetween(1, 4)
      yield* Effect.forEach(
        Array.from({ length: burst }, (_, i) => i),
        () => simulateRequest.pipe(Effect.fork),
        { concurrency: "unbounded" },
      )
    }),
    Schedule.jittered(Schedule.spaced("500 millis")),
  )
})

const backgroundLoop = Effect.gen(function* () {
  yield* Effect.logInfo("simulation: background task loop started")
  yield* Effect.schedule(
    Effect.gen(function* () {
      yield* Effect.fork(simulateBackgroundTask)
      const depth = yield* Random.nextIntBetween(0, 25)
      yield* queueDepth.pipe(Metric.set(depth))
    }),
    Schedule.jittered(Schedule.spaced("2 seconds")),
  )
})

export function layer() {
  return Layer.scopedDiscard(
    Effect.gen(function* () {
      yield* Effect.logInfo("simulation layer starting")
      yield* Effect.forkScoped(requestLoop)
      yield* Effect.forkScoped(backgroundLoop)
      yield* Effect.logInfo("simulation layer ready")
    }),
  )
}
