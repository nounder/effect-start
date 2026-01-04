# Effect-Start Agent Instructions

## 🚨 ABSOLUTE RULES - ZERO TOLERANCE

### FORBIDDEN: try-catch in Effect.gen

**NEVER use try-catch inside Effect.gen generators - causes runtime errors!**

```ts
// ❌ FORBIDDEN
Effect.gen(function*() {
  try {
    const result = yield* someEffect
  } catch (error) { /* never reached */ }
})

// ✅ CORRECT
Effect.gen(function*() {
  const result = yield* Effect.result(someEffect)
  if (result._tag === "Failure") { /* handle */ }
})
```

### FORBIDDEN: Type Assertions

**NEVER use `as any`, `as never`, `as unknown` - fix underlying type issues instead!**

### MANDATORY: return yield* Pattern

**ALWAYS use `return yield*` for errors/interrupts - makes termination explicit!**

```ts
// ✅ CORRECT
if (error) return yield * Effect.fail("error")

// ❌ FORBIDDEN - missing return creates unreachable code
if (error) yield * Effect.fail("error")
```

## 🔧 MANDATORY FUNCTION WORKFLOW

**NEVER skip steps. NEVER continue if step fails.**

1. Create function implementation
2. Run `tsgo` - must compile
3. Write test in `*.test.ts` (co-located)
4. Run `tsc` - test must compile
5. Run `bun test <file>` - must pass

**Rationale:** Zero technical debt, immediate test coverage, catch errors early.

## 📚 Development Patterns

**CRITICAL:** Reference `.patterns/` directory BEFORE implementing:

- **EffectLibraryDevelopment.md** - Core Effect patterns, constructors, composition
- **ErrorHandling.md** - Data.TaggedError, error recovery, testing
- **QuickReference.md** - One-page cheat sheet for common patterns

**Pattern Usage:**

1. Before coding → Review relevant pattern
2. During implementation → Follow established conventions
3. When stuck → Reference similar implementations

## 🧪 Testing Requirements

- Co-locate tests: `Module.test.ts` alongside `Module.ts`
- Use Bun test runner (`bun:test`)
- **CRITICAL:** Time-dependent code MUST use `TestClock` - never wall-clock time
- Run: `bun test <file>` or `bun test` for all

**Time-dependent operations requiring TestClock:**

- `Effect.sleep`, `Effect.delay`, `Effect.timeout`
- Scheduled operations, retry logic, race conditions

## 💻 Validation Commands

```bash
bun test <file>     # Test specific file
bun test            # All tests
tsc                 # Type check
```

**Implementation complete when:**

- ✅ All tests pass
- ✅ All type checks pass (`tsc`)
- ✅ Feature works end-to-end
- ✅ Old/deprecated code removed

## 🎯 Core Principles

- **Research → Plan → Implement** - Never jump to coding
- **Reality Checkpoints** - Validate frequently
- **Zero Tolerance for Errors** - All checks must pass
- **Clarity over Cleverness** - Simple, maintainable solutions
- **No comments** unless explicitly requested

## 📁 Key Directories

```
src/                 # Source code
├── bun/            # Bun-specific implementations
├── client/         # Client-side code
├── hyper/          # Hyper HTML utilities
└── x/              # Extended functionality

.patterns/          # Development patterns (reference before coding)
examples/           # Example applications
```

## 🚫 When Stuck

- Stop spiraling into complex solutions
- Break problem into smaller parts
- Use Task tool for parallel approaches
- Simplify the approach
- Ask for guidance vs. guessing

## 📝 Code Standards

- **Type Safety:** NEVER use `any` type, explicit types preferred
- **Effect Patterns:** Use proper constructors (`Array.make()`, `Chunk.fromIterable()`)
- **Error Handling:** Use `Data.TaggedError` for custom errors
- **Early Returns:** Prefer for readability
- **Never create scripts/tools** unless explicitly requested

## Local Effect Source

The Effect repository is cloned to `~/Projects/effect/.tree/start/packages/effect` for reference.
Use this to explore APIs, find usage examples, and understand implementation
details when the documentation isn't enough.
