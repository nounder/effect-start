# Suggested GitHub Issue

**Title:** `Route.html() cannot set HTTP headers or cookies - need RouteHandler.Encoded support`

**Description:**

## Problem

`Route.html()` handlers currently cannot set HTTP headers (including cookies) because they use `RouteHandler.Value` which expects handlers to return raw values (strings/JSX) that get automatically wrapped in HTTP responses.

This limitation makes it impossible to implement common web patterns like:
- Cookie-based authentication (session cookies)
- HTTP redirects with Set-Cookie headers
- Cache-Control headers on HTML responses
- Custom security headers (CSP, CORS, etc.)

## Current Behavior

```typescript
export default Route.html(function*() {
  const sessionId = yield* createSession()

  // ❌ Cannot do this - type error and runtime failure
  return HttpServerResponse.redirect("/", {
    status: 302,
    headers: { "set-cookie": `session=${sessionId}` }
  })

  // ✅ Can only return HTML/JSX
  return <div>Success! Session created but not sent to browser</div>
})
```

## Root Cause

The Route API has two handler types (from `src/Route.ts:91-127`):
- **`RouteHandler.Value`** (used by `Route.html/json/text`) - Returns raw values wrapped in responses
- **`RouteHandler.Encoded`** - Returns `HttpServerResponse` directly - **not exposed in public API**

`Route.html()` uses `makeValueHandler()` which wraps return values via `HttpServerResponse.html()`, preventing direct response control.

## Impact

This affects real-world use cases:
- Authentication flows (the most common need)
- Form submissions with redirects
- File downloads with custom headers
- Any scenario requiring response metadata alongside content

---

# Analysis: Four Possible Solutions

## Solution 1: Add `Route.response()` Constructor (Recommended)

**Concept:** Expose a new route constructor that returns `RouteHandler.Encoded` for full `HttpServerResponse` control.

```typescript
// New API
export const response = makeMediaFunction(
  "GET",
  "*/*", // or no media constraint
  (handler: Effect.Effect<HttpServerResponse.HttpServerResponse, E, R>) => handler
)

// Usage
export default Route.response(function*() {
  const sessionId = yield* createSession()

  return HttpServerResponse.redirect("/", {
    status: 302,
    headers: { "set-cookie": `session=${sessionId}; HttpOnly` }
  })
})
```

**Pros:**
- ✅ Minimal API surface - just one new export
- ✅ Type-safe - leverages existing `HttpServerResponse` types
- ✅ Flexible - works with any response type (redirect, html, json, etc.)
- ✅ No breaking changes - purely additive
- ✅ Clear separation: `.html()` for simple cases, `.response()` for advanced

**Cons:**
- ⚠️ Requires understanding when to use `.html()` vs `.response()`
- ⚠️ Slightly more verbose for common cases

**Implementation Complexity:** Low - ~20 lines of code

```typescript
// In src/Route.ts, add:
export const response = makeMediaFunction(
  "GET",
  "*/*",
  <E = never, R = never>(
    handler: Effect.Effect<HttpServerResponse.HttpServerResponse, E, R>
  ): RouteHandler.Encoded<E, R> => handler
)
```

---

## Solution 2: Extend `Route.html()` with Response Options

**Concept:** Allow `Route.html()` handlers to return a tuple `[content, options]` where options include headers/cookies.

```typescript
// New signature (backward compatible)
Route.html(function*() {
  const sessionId = yield* createSession()

  // Return tuple: [content, response options]
  return [
    <div>Login successful!</div>,
    {
      status: 200,
      headers: { "set-cookie": `session=${sessionId}; HttpOnly` }
    }
  ]
})

// Or use a builder
Route.html(function*() {
  const sessionId = yield* createSession()

  return Route.withHeaders(
    <div>Login successful!</div>,
    { "set-cookie": `session=${sessionId}; HttpOnly` }
  )
})
```

**Pros:**
- ✅ Ergonomic - keeps using familiar `.html()` API
- ✅ Backward compatible - existing code works unchanged
- ✅ Type-safe - can enforce valid option combinations
- ✅ Composable with helper functions

**Cons:**
- ⚠️ Adds complexity to `makeValueHandler()` to detect tuple returns
- ⚠️ Mixed return types (`JSX | [JSX, Options]`) can confuse type inference
- ⚠️ Need to handle all response types (`.json()`, `.text()`) consistently

**Implementation Complexity:** Medium - requires refactoring `makeValueHandler()` and updating all media functions

```typescript
// Update makeValueHandler to handle tuples
function makeValueHandler<ExpectedRaw = string>(
  responseFn: (raw: ExpectedRaw, options?: ResponseOptions) => HttpServerResponse
) {
  return <A, E = never, R = never>(handler: Effect.Effect<A, E, R>) => {
    return Effect.gen(function*() {
      const result = yield* handler

      // Detect tuple format
      if (Array.isArray(result) && result.length === 2) {
        const [raw, options] = result
        return {
          [HttpServerRespondable.symbol]: () =>
            Effect.succeed(responseFn(raw, options)),
          raw
        }
      }

      // Standard format
      return {
        [HttpServerRespondable.symbol]: () =>
          Effect.succeed(responseFn(result as ExpectedRaw)),
        raw: result
      }
    })
  }
}
```

---

## Solution 3: Response Context Builder

**Concept:** Provide a service that handlers can yield to for building responses imperatively.

```typescript
// New service
class RouteResponseBuilder extends Effect.Service<RouteResponseBuilder>()("RouteResponseBuilder", {
  succeed: Effect.sync(() => ({
    headers: {} as Record<string, string>,
    status: 200,

    setHeader(key: string, value: string) {
      this.headers[key] = value
      return this
    },

    setCookie(name: string, value: string, options?: CookieOptions) {
      this.setHeader("set-cookie", formatCookie(name, value, options))
      return this
    },

    setStatus(status: number) {
      this.status = status
      return this
    }
  }))
}) {}

// Usage
export default Route.html(function*() {
  const response = yield* RouteResponseBuilder
  const sessionId = yield* createSession()

  response.setCookie("session", sessionId, { httpOnly: true })

  return <div>Login successful!</div>
})
```

**Pros:**
- ✅ Familiar imperative API (like Express.js `res.cookie()`)
- ✅ Easy to compose - set headers anywhere in the handler
- ✅ Type-safe and discoverable
- ✅ No changes to return type

**Cons:**
- ⚠️ Stateful approach less idiomatic in Effect
- ⚠️ Requires service injection infrastructure
- ⚠️ Harder to test - side effects hidden in yields
- ⚠️ `makeValueHandler()` needs to read builder state

**Implementation Complexity:** High - requires new service layer and integration with route handler wrapping

---

## Solution 4: Middleware/Interceptor Pattern

**Concept:** Return metadata from handlers that middleware intercepts and applies to responses.

```typescript
// Special return type with metadata
import { RouteResponse } from "effect-start"

export default Route.html(function*() {
  const sessionId = yield* createSession()

  return RouteResponse.make(
    <div>Login successful!</div>,
    {
      cookies: [
        { name: "session", value: sessionId, httpOnly: true }
      ]
    }
  )
})

// Framework automatically detects RouteResponse and applies metadata
```

**Pros:**
- ✅ Declarative - all metadata in return value
- ✅ Testable - pure data structures
- ✅ Composable - can merge metadata from multiple sources
- ✅ Separation of concerns - handler provides intent, framework applies it

**Cons:**
- ⚠️ Requires wrapping all values in `RouteResponse.make()`
- ⚠️ More abstraction - another concept to learn
- ⚠️ Need to handle unwrapping throughout the framework
- ⚠️ Mixing `RouteResponse` with raw JSX reduces type safety

**Implementation Complexity:** Medium-High - requires new abstraction and framework-wide support

```typescript
// Add RouteResponse type
export namespace RouteResponse {
  export interface Metadata {
    headers?: Record<string, string>
    cookies?: Array<Cookie>
    status?: number
  }

  export interface WithMetadata<T> {
    _tag: "RouteResponse"
    value: T
    metadata: Metadata
  }

  export const make = <T>(value: T, metadata: Metadata): WithMetadata<T> => ({
    _tag: "RouteResponse",
    value,
    metadata
  })

  export const isRouteResponse = <T>(val: unknown): val is WithMetadata<T> =>
    typeof val === "object" && val !== null && "_tag" in val && val._tag === "RouteResponse"
}

// Update makeValueHandler
function makeValueHandler<ExpectedRaw = string>(responseFn: ...) {
  return <A, E, R>(handler: Effect.Effect<A, E, R>) => {
    return Effect.gen(function*() {
      const raw = yield* handler

      if (RouteResponse.isRouteResponse(raw)) {
        const { value, metadata } = raw
        return {
          [HttpServerRespondable.symbol]: () =>
            Effect.succeed(
              applyMetadata(responseFn(value), metadata)
            ),
          raw: value
        }
      }

      return {
        [HttpServerRespondable.symbol]: () =>
          Effect.succeed(responseFn(raw as ExpectedRaw)),
        raw
      }
    })
  }
}
```

---

# Recommendation

**Solution 1 (`Route.response()`)** is the best choice because:

1. **Minimal implementation** - Can be added in ~20 lines
2. **No breaking changes** - Purely additive API
3. **Maximum flexibility** - Direct access to `HttpServerResponse` API
4. **Clear mental model** - Simple handlers use `.html()`, advanced use `.response()`
5. **Leverages existing types** - No new abstractions needed

## Migration path for common use case (auth with redirect)

```typescript
// Before (doesn't work)
export default Route.html(function*() {
  const sessionId = yield* createSession()
  return HttpServerResponse.redirect("/") // ❌ Type error
})

// After with Route.response()
export default Route.response(function*() {
  const sessionId = yield* createSession()

  return HttpServerResponse.redirect("/", {
    status: 302,
    headers: {
      "set-cookie": `session=${sessionId}; Path=/; HttpOnly; Max-Age=2592000`
    }
  })
})
```

## For hybrid HTML + cookies

```typescript
export default Route.response(function*() {
  const sessionId = yield* createSession()

  const html = HyperHtml.renderToString(
    <div>Login successful!</div>
  )

  return HttpServerResponse.html(html, {
    headers: {
      "set-cookie": `session=${sessionId}; Path=/; HttpOnly`
    }
  })
})
```

This provides an immediate solution while keeping the door open for ergonomic improvements (Solution 2 or 4) in future versions.
