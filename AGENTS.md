# Agent Instructions for Effect-Start Development

## 🚨 HIGHEST PRIORITY RULES 🚨

### ABSOLUTELY FORBIDDEN: try-catch in Effect.gen

**NEVER use `try-catch` blocks inside `Effect.gen` generators!**

- Effect generators handle errors through the Effect type system, not JavaScript exceptions
- Use `Effect.tryPromise`, `Effect.try`, or proper Effect error handling instead
- **CRITICAL**: This will cause runtime errors and break Effect's error handling
- **EXAMPLE OF WHAT NOT TO DO**:
  ```ts
  Effect.gen(function*() {
    try {
      // ❌ WRONG - Never do this in Effect.gen
      const result = yield* someEffect
    } catch (error) {
      // ❌ This will never be reached and breaks Effect semantics
    }
  })
  ```
- **CORRECT PATTERN**:
  ```ts
  Effect.gen(function*() {
    // ✅ Use Effect's built-in error handling
    const result = yield* Effect.result(someEffect)
    if (result._tag === "Failure") {
      // Handle error case
    }
  })
  ```

### ABSOLUTELY FORBIDDEN: Type Assertions

**NEVER EVER use `as never`, `as any`, or `as unknown` type assertions!**

- These break TypeScript's type safety and hide real type errors
- Always fix the underlying type issues instead of masking them
- **FORBIDDEN PATTERNS**:
  ```ts
  // ❌ NEVER do any of these
  const value = something as any
  const value = something as never
  const value = something as unknown
  ```
- **CORRECT APPROACH**: Fix the actual type mismatch by:
  - Using proper generic type parameters
  - Importing correct types
  - Using proper Effect constructors and combinators
  - Adjusting function signatures to match usage

### MANDATORY: Return Yield Pattern for Errors

**ALWAYS use `return yield*` when yielding errors or interrupts in Effect.gen!**

- When yielding `Effect.fail`, `Effect.interrupt`, or other terminal effects, always use `return yield*`
- This makes it clear that the generator function terminates at that point
- **MANDATORY PATTERN**:

  ```ts
  Effect.gen(function*() {
    if (someCondition) {
      // ✅ CORRECT - Always use return yield* for errors
      return yield* Effect.fail("error message")
    }

    if (shouldInterrupt) {
      // ✅ CORRECT - Always use return yield* for interrupts
      return yield* Effect.interrupt
    }

    // Continue with normal flow...
    const result = yield* someOtherEffect
    return result
  })
  ```

- **WRONG PATTERNS**:
  ```ts
  Effect.gen(function*() {
    if (someCondition) {
      // ❌ WRONG - Missing return keyword
      yield* Effect.fail("error message")
      // Unreachable code after error!
    }
  })
  ```
- **CRITICAL**: Always use `return yield*` to make termination explicit and avoid unreachable code

## Project Overview

This is effect-start, a framework for building Effect-based web applications with Bun runtime.

## Development Workflow

### Core Principles

- **Research → Plan → Implement**: Never jump straight to coding
- **Reality Checkpoints**: Regularly validate progress and approach
- **Zero Tolerance for Errors**: All automated checks must pass
- **Clarity over Cleverness**: Choose clear, maintainable solutions

### Structured Development Process

1. **Research Phase**
   - Understand the codebase and existing patterns
   - Identify related modules and dependencies
   - Review test files and usage examples
   - Use multiple approaches for complex problems

2. **Planning Phase**
   - Create detailed implementation plan
   - Identify validation checkpoints
   - Consider edge cases and error handling
   - Validate plan before implementation

3. **Implementation Phase**
   - Execute with frequent validation
   - Run automated checks at each step
   - Use parallel approaches when possible
   - Stop and reassess if stuck

### 🚨 MANDATORY FUNCTION DEVELOPMENT WORKFLOW 🚨

**ALWAYS follow this EXACT sequence when creating ANY new function:**

1. **Create function** - Write the function implementation in TypeScript file
2. **Check compilation** - Run `tsc` to ensure it compiles
3. **Write test** - Create comprehensive test for the function in test file (co-located as `*.test.ts`)
4. **Compile test** - Run `tsc` again to check test file compiles
5. **Run test** - Run `bun test <test_file.ts>` to verify functionality

**CRITICAL NOTES:**

- **NEVER SKIP ANY STEP** - This workflow is MANDATORY for every single function created
- **NEVER CONTINUE** to the next step until the current step passes completely
- **NEVER CREATE MULTIPLE FUNCTIONS** without completing this full workflow for each one

This ensures:

- Zero compilation errors at any point
- Immediate test coverage for every function
- No accumulation of technical debt

### Mandatory Validation Steps

- Run tests after making changes: `bun test <test_file.ts>`
- Run type checking: `tsc` or `bun run type`
- Always check for type errors before committing: `tsc`

### When Stuck

- Stop spiraling into complex solutions
- Break down the problem into smaller parts
- Use the Task tool for parallel problem-solving
- Simplify the approach
- Ask for guidance rather than guessing

## Code Style Guidelines

### TypeScript Quality Standards

- **Type Safety**: NEVER use `any` type or `as any` assertions
- **Explicit Types**: Use concrete types over generic `unknown` where possible
- **Type Annotations**: Add explicit annotations when inference fails
- **Early Returns**: Prefer early returns for better readability
- **Input Validation**: Validate all inputs at boundaries
- **Error Handling**: Use proper Effect error management patterns

### Effect Library Conventions

- Follow existing TypeScript patterns in the codebase
- Use functional programming principles
- Maintain consistency with Effect library conventions
- Use proper Effect constructors (e.g., `Array.make()`, `Chunk.fromIterable()`)
- Prefer `Effect.gen` for monadic composition
- Use `Data.TaggedError` for custom error types
- Implement resource safety with automatic cleanup patterns

### Code Organization

- No comments unless explicitly requested
- Follow existing file structure and naming conventions
- Delete old code when replacing functionality
- **NEVER create new script files or tools unless explicitly requested by the user**
- Choose clarity over cleverness in all implementations

### Implementation Completeness

Code is considered complete only when:

- All tests pass (`bun test`)
- All type checks pass (`tsc`)
- Feature works end-to-end
- Old/deprecated code is removed

## Testing

- Test files are co-located with source files as `*.test.ts`
- Uses Bun's built-in test runner (`bun:test`)
- Always verify implementations with tests
- Run specific tests with: `bun test <filename>`
- Run all tests: `bun test`

### Bun Test Patterns

**Basic Test Structure**:

```ts
import * as test from "bun:test"
import * as Effect from "effect/Effect"
import * as MyModule from "./MyModule.ts"

test.describe("MyModule", () => {
  test.it("should do something", () => {
    const result = MyModule.doSomething()
    test.expect(result).toBe(expected)
  })

  test.it("should work with Effects", async () => {
    const program = Effect.gen(function*() {
      const result = yield* MyModule.effectOperation()
      return result
    })

    const result = await Effect.runPromise(program)
    test.expect(result).toBe(expected)
  })
})
```

### Time-Dependent Testing

- **CRITICAL**: When testing time-dependent code (delays, timeouts, scheduling), always use `TestClock` to avoid flaky tests
- Import `TestClock` from `effect/TestClock` and use `TestClock.adjust()` to control time progression
- Never rely on real wall-clock time (`Effect.sleep`, `Effect.timeout`) in tests without TestClock
- Examples of time-dependent operations that need TestClock:
  - `Effect.sleep()` and `Effect.delay()`
  - `Effect.timeout()` and `Effect.race()` with timeouts
  - Scheduled operations and retry logic
  - Queue operations with time-based completion
  - Any concurrent operations that depend on timing
- Pattern: Use `TestClock.adjust("duration")` to simulate time passage instead of actual delays

**Example with TestClock**:

```ts
import * as test from "bun:test"
import * as Effect from "effect/Effect"
import * as TestClock from "effect/TestClock"

test.describe("Time-dependent operations", () => {
  test.it("should handle delays", async () => {
    const program = Effect.gen(function*() {
      // Start a delayed operation
      const fiber = yield* Effect.fork(
        Effect.gen(function*() {
          yield* Effect.sleep("1 second")
          return "completed"
        })
      )

      // Advance the test clock
      yield* TestClock.adjust("1 second")

      // Check the result
      const result = yield* Effect.Fiber.join(fiber)
      return result
    })

    const result = await Effect.runPromise(program)
    test.expect(result).toBe("completed")
  })
})
```

## Git Workflow

- Main branch: `main`
- Create feature branches for new work
- Only commit when explicitly requested
- Follow conventional commit messages

## Key Directories

### Source Code

- `src/` - Main source code directory
  - `bun/` - Bun-specific implementations
  - `client/` - Client-side code
  - `hyper/` - Hyper HTML utilities
  - `x/` - Extended functionality modules
  - `*.test.ts` - Test files co-located with source

### Examples & Documentation

- `examples/` - Example applications
  - `bun-react-spa/` - React SPA example
  - `bun-react-tanstack-router/` - TanStack Router example
  - `bun-preact/` - Preact example
  - `movies/` - Movies demo app
- `doc/` - Documentation files
- `static/` - Static assets

### Development & Configuration

- `.patterns/` - Development patterns and best practices
  - `README.md` - Pattern organization and usage guide
  - `effect-library-development.md` - Core Effect patterns
  - `error-handling.md` - Structured error management patterns
- `.claude/` - Claude AI development commands
- `tsconfig.json` - TypeScript configuration
- `dprint.json` - Code formatting configuration

## Development Patterns Reference

The `.patterns/` directory contains comprehensive development patterns and best practices for Effect-based development. **Always reference these patterns before implementing new functionality** to ensure consistency with established codebase conventions.

### Core Patterns to Follow:

- **Effect Library Development**: Fundamental patterns, forbidden practices, and mandatory patterns
- **Error Handling**: Data.TaggedError usage, error transformation, and recovery patterns

### Pattern Usage Guidelines:

1. **Before coding**: Review relevant patterns in `.patterns/` directory
2. **During implementation**: Follow established conventions and naming patterns
3. **For complex features**: Use patterns as templates for consistent implementation
4. **When stuck**: Reference similar implementations in existing codebase following these patterns

## Problem-Solving Strategies

### When Encountering Complex Issues

1. **Stop and Analyze**: Don't spiral into increasingly complex solutions
2. **Break Down**: Divide complex problems into smaller, manageable parts
3. **Use Parallel Approaches**: Launch multiple Task agents for different aspects
4. **Research First**: Always understand existing patterns before creating new ones
5. **Validate Frequently**: Use reality checkpoints to ensure you're on track
6. **Simplify**: Choose the simplest solution that meets requirements
7. **Ask for Help**: Request guidance rather than guessing

### Effective Task Management

- Use TodoWrite/TodoRead tools for complex multi-step tasks
- Mark tasks as in_progress before starting work
- Complete tasks immediately upon finishing
- Break large tasks into smaller, trackable components

## Performance Considerations

- **Measure First**: Always measure performance before optimizing
- Prefer eager evaluation patterns where appropriate
- Consider memory usage and optimization
- Follow established performance patterns in the codebase
- Prioritize clarity over premature optimization
- Use appropriate data structures for the use case
