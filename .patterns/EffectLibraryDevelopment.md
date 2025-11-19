# Effect Library Development Patterns

## 🎯 OVERVIEW

Fundamental patterns for developing high-quality, type-safe code within the Effect library ecosystem. These patterns ensure consistency, reliability, and maintainability across the codebase.

## 🚨 CRITICAL FORBIDDEN PATTERNS

### ❌ NEVER: try-catch in Effect.gen

**REASON**: Effect generators handle errors through the Effect type system, not JavaScript exceptions.

```typescript
// ❌ WRONG - This will cause runtime errors
Effect.gen(function*() {
  try {
    const result = yield* someEffect
    return result
  } catch (error) {
    // This will never be reached and breaks Effect semantics
    console.error(error)
  }
})

// ✅ CORRECT - Use Effect's built-in error handling
Effect.gen(function*() {
  const result = yield* Effect.result(someEffect)
  if (result._tag === "Failure") {
    // Handle error case properly
    console.error("Effect failed:", result.cause)
    return yield* Effect.fail("Handled error")
  }
  return result.value
})
```

### ❌ NEVER: Type Assertions

**REASON**: Type assertions hide real type errors and break TypeScript's safety guarantees.

```typescript
// ❌ FORBIDDEN - These break type safety
const value = something as any
const value = something as never
const value = something as unknown

// ✅ CORRECT - Fix the underlying type issues
// Use proper generic type parameters
function processValue<T>(value: T): Effect.Effect<T, never, never> {
  return Effect.succeed(value)
}

// Use proper Effect constructors
const safeValue = Effect.try(() => JSON.parse(jsonString))
```

## ✅ MANDATORY PATTERNS

### 🔄 return yield* Pattern for Errors

**CRITICAL**: Always use `return yield*` when yielding terminal effects.

```typescript
// ✅ CORRECT - Makes termination explicit
Effect.gen(function*() {
  if (invalidCondition) {
    return yield* Effect.fail("Validation failed")
  }

  if (shouldInterrupt) {
    return yield* Effect.interrupt
  }

  // Continue with normal flow
  const result = yield* someOtherEffect
  return result
})

// ❌ WRONG - Missing return keyword leads to unreachable code
Effect.gen(function*() {
  if (invalidCondition) {
    yield* Effect.fail("Validation failed") // Missing return!
    // Unreachable code after error!
  }
})
```

## 🏗️ CORE DEVELOPMENT PATTERNS

### Effect.gen Composition Pattern

Use `Effect.gen` for sequential operations with proper error propagation:

```typescript
import {
  Console,
  Effect,
} from "effect"

const processData = (input: string) =>
  Effect.gen(function*() {
    // Validate input
    if (input.length === 0) {
      return yield* Effect.fail("Input cannot be empty")
    }

    // Transform data
    const processed = yield* Effect.try({
      try: () => JSON.parse(input),
      catch: (error) => `Invalid JSON: ${error}`,
    })

    // Log progress
    yield* Console.log(`Processed: ${JSON.stringify(processed)}`)

    return processed
  })
```

### Error Handling with Data.TaggedError

Create structured, typed errors using `Data.TaggedError`:

```typescript
import {
  Data,
  Effect,
} from "effect"

// Define custom error types
class ValidationError extends Data.TaggedError("ValidationError")<{
  field: string
  message: string
}> {}

class NetworkError extends Data.TaggedError("NetworkError")<{
  status: number
  url: string
}> {}

// Use in operations
const validateAndFetch = (url: string) =>
  Effect.gen(function*() {
    if (!url.startsWith("https://")) {
      return yield* Effect.fail(
        new ValidationError({
          field: "url",
          message: "URL must use HTTPS",
        }),
      )
    }

    const response = yield* Effect.tryPromise({
      try: () => fetch(url),
      catch: () => new NetworkError({ status: 0, url }),
    })

    if (!response.ok) {
      return yield* Effect.fail(
        new NetworkError({
          status: response.status,
          url,
        }),
      )
    }

    return response
  })
```

### Resource Management Pattern

Use `Effect.acquireUseRelease` for automatic resource cleanup:

```typescript
import {
  Console,
  Effect,
} from "effect"

// Resource acquisition pattern
const withDatabase = <A, E>(
  operation: (db: Database) => Effect.Effect<A, E, never>,
): Effect.Effect<A, E | DatabaseError, never> =>
  Effect.acquireUseRelease(
    // Acquire
    Effect.tryPromise({
      try: () => createDatabaseConnection(),
      catch: (error) => new DatabaseError({ cause: error }),
    }),
    // Use
    operation,
    // Release
    (db) => Effect.promise(() => db.close()),
  )

// Usage
const queryUser = (id: string) =>
  withDatabase((db) =>
    Effect.gen(function*() {
      const user = yield* Effect.tryPromise({
        try: () => db.query("SELECT * FROM users WHERE id = ?", [id]),
        catch: (error) => new QueryError({ query: "users", cause: error }),
      })

      yield* Console.log(`Found user: ${user.name}`)
      return user
    })
  )
```

### Layer Composition Pattern

Build applications using layered architecture:

```typescript
import {
  Context,
  Effect,
  Layer,
} from "effect"

// Define service interfaces
class DatabaseService extends Context.Tag("DatabaseService")<
  DatabaseService,
  {
    readonly query: (
      sql: string,
    ) => Effect.Effect<unknown[], DatabaseError, never>
  }
>() {}

class UserService extends Context.Tag("UserService")<
  UserService,
  {
    readonly getUser: (id: string) => Effect.Effect<User, UserError, never>
  }
>() {}

// Implement services as layers
const DatabaseServiceLive = Layer.succeed(
  DatabaseService,
  DatabaseService.of({
    query: (sql) =>
      Effect.tryPromise({
        try: () => database.execute(sql),
        catch: (error) => new DatabaseError({ cause: error }),
      }),
  }),
)

const UserServiceLive = Layer.effect(
  UserService,
  Effect.gen(function*() {
    const db = yield* DatabaseService

    return UserService.of({
      getUser: (id) =>
        Effect.gen(function*() {
          const rows = yield* db.query(`SELECT * FROM users WHERE id = '${id}'`)
          if (rows.length === 0) {
            return yield* Effect.fail(
              new UserError({ message: "User not found" }),
            )
          }
          return rows[0] as User
        }),
    })
  }),
)

// Compose layers
const AppLayer = UserServiceLive.pipe(
  Layer.provide(DatabaseServiceLive),
)
```

## 🔧 DEVELOPMENT WORKFLOW PATTERNS

### Validation Checkpoint Pattern

Run comprehensive validation after implementation:

```bash
# 1. Check types
tsc

# 2. Run specific test
bun test <test_file.ts>

# 3. Run all tests
bun test
```

### Progressive Implementation Pattern

Break complex features into validated increments:

```typescript
// Step 1: Basic structure with types
interface FeatureConfig {
  readonly option1: string
  readonly option2: number
}

// Step 2: Core implementation
const createFeature = (config: FeatureConfig) =>
  Effect.gen(function*() {
    // Basic implementation
    yield* Console.log("Feature created")
    return { config }
  })

// Step 3: Add error handling
const createFeatureWithValidation = (config: FeatureConfig) =>
  Effect.gen(function*() {
    if (config.option2 < 0) {
      return yield* Effect.fail("Option2 must be positive")
    }

    const feature = yield* createFeature(config)
    return feature
  })

// Step 4: Add comprehensive functionality
// ... continue building incrementally
```

## 📚 TESTING PATTERNS

### Basic Testing Pattern

Structure tests with Bun test runner:

```typescript
import * as t from "bun:test"
import * as HyperNode from "./HyperNode.ts"
import * as HyperHtml from "./HyperHtml.ts"

t.it("boolean true attributes render without value", () => {
  const node = HyperNode.make("div", {
    hidden: true,
    disabled: true,
  })

  const html = HyperHtml.renderToString(node)

  t.expect(html).toBe("<div hidden disabled></div>")
})

t.it("string attributes render with values", () => {
  const node = HyperNode.make("div", {
    id: "test",
    class: "my-class",
  })

  const html = HyperHtml.renderToString(node)

  t.expect(html).toBe("<div id=\"test\" class=\"my-class\"></div>")
})
```

### Type-Safe Testing Pattern

Use Effect and type satisfaction checks for compile-time validation:

```typescript
import * as t from "bun:test"
import * as Effect from "effect/Effect"
import * as Function from "effect/Function"
import * as Schema from "effect/Schema"
import * as Route from "./Route.ts"

t.it("types default routes", () => {
  const routes = Route
    .text(Effect.succeed("hello"))
    .html(Effect.succeed("<div>world</div>"))

  type Expected = Route.RouteSet<[
    Route.Route<"GET", "text/plain">,
    Route.Route<"GET", "text/html">,
  ]>

  Function.satisfies<Expected>()(routes)
})

t.it("context is typed with schemas", () => {
  const PathSchema = Schema.Struct({
    id: Schema.String,
  })

  Route
    .schemaPathParams(PathSchema)
    .text((context) => {
      Function.satisfies<string>()(context.pathParams.id)
      return Effect.succeed("hello")
    })
})
```

This comprehensive set of patterns ensures consistent, high-quality development across the Effect library while maintaining type safety and functional programming principles.
