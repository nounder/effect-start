# Environment

Use Bun runtime and package manager:

```
bun install
bunx tsc
```

# Code

- Do NOT use section header comments (like `// ---`)
- Do not write obvious comments that restate what the code is doing
  without adding meaningful context.
- Inline logic that is 1-2 lines instead of defining a function that is only referenced once.

## Module structure

- Module designed to be used should have no side-effects and no default export (only named exports).
- Private, or internal, modules live in an `internal/` subdirectory next to the public modules that use them, like `src/internal/ContentNegotiation.ts` or `src/studio/internal/Pretty.ts`.

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

# Modules

- Export smallest possible surface to make the module useful.
- Do NOT export types, functions, or symbols that are not used outside of the module.

# Effect

The Effect source code is in `./vendor/effect/src` for reference.
Use this to explore APIs, find usage examples, and understand implementation
details when the documentation isn't enough.

## Promises

```ts
// Always use tryPromise() and map to TaggedError
Effect.tryPromise({
  try: () => fetch(`https://example.com`),
  // remap the error
  catch: (cause) => new FetchError({ reason: "Network", cause }),
})

class FetchError extends Data.TaggedError("FetchError")<{
  reason: "Network" | "Status"
  cause?: unknown
  message: string
}> {}
```

## Running tests

Run test when making final changes:

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
import * as test from "bun:test"

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

```ts
// when test runs effect, wrap the entire body in Effect.gen/pipe
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
