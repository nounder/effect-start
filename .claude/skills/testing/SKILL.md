---
name: testing
description: Write TypeScript runtime and type tests (project)
---

# Testing Skill

Write TypeScript runtime and type tests for this project.

## Imports

```ts
import * as test from "bun:test"
import * as type from "expect-type"
```

## Test Structure

Use `test.it` for individual tests and `test.describe` for grouping:

```ts
test.describe("MyModule", () => {
  test.it("should do something", () => {
    // test body
  })
})
```

Never use `test.test` - always use `test.it`.

## Assertion Formatting

Put each method call on a new line with 2-space indentation:

```ts
test
  .expect(value)
  .toBe(expected)

test
  .expect(result)
  .toEqual({ foo: "bar" })

test
  .expect(() => riskyOperation())
  .toThrow("error message")
```

No blank lines between consecutive assertions:

```ts
test
  .expect(a)
  .toBe(1)
test
  .expect(b)
  .toBe(2)
test
  .expect(c)
  .toBe(3)
```

## Type Assertions with expect-type

Use `expect-type` for compile-time type checking. Inline types directly - no type aliases:

```ts
// Check a value matches a type
type
  .expectTypeOf(someValue)
  .toMatchTypeOf<ExpectedType>()

// Check two types are exactly equal
type
  .expectTypeOf<ActualType>()
  .toEqualTypeOf<ExpectedType>()

// Check a type extends another
type
  .expectTypeOf<SubType>()
  .toExtend<SuperType>()
```

## Naming Conventions

Avoid variable names that shadow imports. Use descriptive suffixes:

```ts
// Bad - shadows `test` import
const test = Commander.make({ name: "test" })

// Good
const testCmd = Commander.make({ name: "test" })
```

## File Location

Co-locate tests with source files: `Module.test.ts` alongside `Module.ts`
