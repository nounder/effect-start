# Environment

- Use Bun runtime and package manager.

# Code

- Do NOT use section header comments (like `// -----------------------`)

## Import rules

```ts
// when importing Node modules name them like such:
import * as NPath from "node:path`
// always import test module as namespace:
import * as test from "bun:test"
// import Effect sub-modules directly
import * as Schema from "effect/Schema"
// Always use extension in local module imports:
import type * as Files from "./Files.ts"
// When import module is lowercase, prefer named imports:
import { server } from "./server.ts"
```

## Comments

Do not write obvious comments that restate what the code is doing
without adding meaningful context.

## Running tests

Always run test when making final changes:

```sh
# run all tests
bun test

# run specific test
bun test routing.test.ts

# type check
tsgo
```

## Writing tests

```ts
// use test.expect when testing runtime
test.expect(routes).toEqual([
  {
    type: "Literal",
  },
])

// use test.expectTypeOf when testing types
test.expectTypeOf(context).toMatchObjectType<{
  method: "GET"
}>()
```

When a test runs Effects, wrap the entire test body in
`Effect.gen(...).pipe(Effect.runPromise)` instead of using `async`/`await`.
Use `yield*` for effects and `Effect.promise` for plain promises.

```ts
// good
test.it("does something", () =>
  Effect.gen(function* () {
    yield* Commander.parse(cmd, args)
    test.expect(executed).toBe(false)
  }).pipe(Effect.scoped, Effect.runPromise),
)

// bad
test.it("does something", async () => {
  await Effect.runPromise(Commander.parse(cmd, args))
  test.expect(executed).toBe(false)
})
```

# Effect

## Promises

```ts
// Always use tryPromise() and map to TaggedError
Effect.tryPromise({
  try: () => fetch(`https://example.com`),
  // remap the error
  catch: (cause) => new FetchError({ reason: "Network", cause }),
})

class FetchError extends Data.TaggedError("FetchError")<{
  readonly reason: "Network" | "Status"
  readonly cause?: unknown
}> {}
```
