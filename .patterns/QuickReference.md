# Quick Reference - Effect-Start Patterns

## 🚨 Never Do This

```ts
// ❌ try-catch in Effect.gen - breaks Effect semantics
Effect.gen(function*() {
  try {
    const result = yield* someEffect
  } catch (error) { /* never reached */ }
})

// ❌ Type assertions - hide real errors
const value = something as any

// ❌ Missing return before error yield
Effect.gen(function*() {
  if (error) yield* Effect.fail("error") // Missing return!
})
```

## ✅ Always Do This

```ts
// ✅ return yield* for errors/interrupts
Effect.gen(function*() {
  if (error) return yield* Effect.fail("error")
  const result = yield* someEffect
  return result
})

// ✅ TestClock for time-dependent tests
const fiber = yield* Effect.fork(Effect.sleep("1 second"))
yield* TestClock.adjust("1 second")
const result = yield* Effect.Fiber.join(fiber)

// ✅ Data.TaggedError for custom errors
class ValidationError extends Data.TaggedError("ValidationError")<{
  field: string
  message: string
}> {}
```

## Common Patterns

### Create Effect Function

```ts
export const myFunction = (input: string) =>
  Effect.gen(function*() {
    // Validate
    if (!input) return yield* Effect.fail("empty input")

    // Process
    const result = yield* Effect.try({
      try: () => JSON.parse(input),
      catch: (error) => `Parse error: ${error}`
    })

    return result
  })
```

### Handle Errors by Type

```ts
operation(input).pipe(
  Effect.catchTag("ValidationError", error =>
    Effect.succeed("fallback value")
  ),
  Effect.catchTag("NetworkError", error =>
    Effect.retry(Schedule.exponential("100 millis"))
  )
)
```

### Handle All Errors

```ts
operation(input).pipe(
  Effect.catchAll(error => {
    Console.error(`Failed: ${error}`)
    return Effect.succeed("default")
  })
)
```

### Resource Management

```ts
const withResource = <A, E>(
  operation: (resource: Resource) => Effect.Effect<A, E>
) =>
  Effect.acquireUseRelease(
    // Acquire
    Effect.tryPromise({
      try: () => createResource(),
      catch: (error) => new ResourceError({ cause: error })
    }),
    // Use
    operation,
    // Release (always runs)
    (resource) => Effect.promise(() => resource.close())
  )
```

### Test with Time

```ts
import * as TestClock from "effect/TestClock"

test.it("should handle delay", async () => {
  const program = Effect.gen(function*() {
    const fiber = yield* Effect.fork(
      Effect.gen(function*() {
        yield* Effect.sleep("5 seconds")
        return "completed"
      })
    )

    // Advance test clock (not wall clock)
    yield* TestClock.adjust("5 seconds")

    const result = yield* Effect.Fiber.join(fiber)
    return result
  })

  const result = await Effect.runPromise(program)
  test.expect(result).toBe("completed")
})
```

### Service Layer Pattern

```ts
// Define service
class UserService extends Context.Tag("UserService")<
  UserService,
  {
    readonly getUser: (id: string) => Effect.Effect<User, UserError>
  }
>() {}

// Implement as layer
const UserServiceLive = Layer.effect(
  UserService,
  Effect.gen(function*() {
    const db = yield* DatabaseService

    return UserService.of({
      getUser: (id) =>
        Effect.gen(function*() {
          const rows = yield* db.query(`SELECT * FROM users WHERE id = ?`, [id])
          if (rows.length === 0) {
            return yield* Effect.fail(new UserError({ message: "Not found" }))
          }
          return rows[0] as User
        })
    })
  })
)
```

### Error Testing

```ts
test.it("should fail with ValidationError", async () => {
  const program = Effect.gen(function*() {
    const result = yield* Effect.exit(operation("invalid"))

    if (result._tag === "Failure") {
      test.expect(ValidationError.isValidationError(result.cause)).toBe(true)
      const error = result.cause as ValidationError
      test.expect(error.field).toBe("input")
    } else {
      test.fail("Expected operation to fail")
    }
  })

  await Effect.runPromise(program)
})
```

## Mandatory Workflow

**For every new function:**

1. Create function implementation
2. Run `tsc` - must compile
3. Write test in `*.test.ts` (co-located)
4. Run `tsc` - test must compile
5. Run `bun test <file>` - must pass

**Never skip steps. Never continue if step fails.**

## Validation Commands

```bash
tsc                # Type check
bun test <file>    # Test specific file
bun test           # All tests
```

## See Full Patterns

- **[EffectLibraryDevelopment.md](./EffectLibraryDevelopment.md)** - Complete Effect patterns, constructors, Layer composition
- **[ErrorHandling.md](./ErrorHandling.md)** - Comprehensive error handling, recovery patterns, error testing
- **[README.md](./README.md)** - Pattern organization and usage guide
