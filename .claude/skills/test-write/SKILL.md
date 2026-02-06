---
name: testing
description: Write TypeScript runtime and type tests
---

# Testing Skill

Write TypeScript runtime and type tests for this project.

## Imports

```ts
import * as test from "bun:test"
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
test.expect(value).toBe(expected)

test.expect(result).toEqual({ foo: "bar" })

test.expect(() => riskyOperation()).toThrow("error message")
```

## Type Assertions with expect-type

Use `expect-type` for compile-time type checking. Inline types directly - no type aliases:

```ts
// Check a value matches a type
type.expectTypeOf(someValue).toMatchObjectType<ExpectedType>()

// Check two types are exactly equal
type.expectTypeOf<ActualType>().toMatchObjectType<ExpectedType>()

// Check a type extends another (less strict)
type.expectTypeOf<SubType>().toExtend<SuperType>()
```

## Variable names

Avoid variable names that shadow imports. Use descriptive suffixes:

```ts
// Bad - shadows `test` import
const test = Commander.make({ name: "test" })

// Good
const testCmd = Commander.make({ name: "test" })
```

## describe() block

When testing multiple exported functions or logic, use describe() at the root:

```
// when testing a function, use its reference:
test.describe(PathPattern.parseSegment, () => {})

test.describe("Params", () => {})
```

Keep describe() blocks flat and never wrap them in describe(MODULE_NAME)

## File Location

Co-locate tests with source files: `Module.test.ts` alongside `Module.ts`
