# Effect Library Development Patterns

## 🎯 PURPOSE

This directory provides reusable solutions and best practices for Effect TypeScript development, ensuring consistency and quality across the Effect library codebase.

## 📚 AVAILABLE PATTERNS

### Core Development Patterns

**[EffectLibraryDevelopment.md](./EffectLibraryDevelopment.md)**

- **Use for:** New functions, Effect.gen composition, resource management, Layer patterns
- **Contains:** Effect constructors, testing with TestClock, validation workflows
- **Reference before:** Creating any new Effect-based function or service

**[ErrorHandling.md](./ErrorHandling.md)**

- **Use for:** Creating custom errors, error recovery, retry logic, error testing
- **Contains:** Data.TaggedError patterns, catchTag/catchAll, error transformations
- **Reference before:** Implementing error handling, validation, or failure recovery

**[QuickReference.md](./QuickReference.md)**

- **Use for:** Quick lookup of common patterns
- **Contains:** One-page cheat sheet with dos/don'ts, common code snippets
- **Reference when:** Need quick reminder of mandatory patterns

## 🎯 QUICK REFERENCE

**Creating new Effect function?** → EffectLibraryDevelopment.md (Effect.gen patterns)
**Handling errors?** → ErrorHandling.md (Data.TaggedError section)
**Testing time-dependent code?** → EffectLibraryDevelopment.md (TestClock section)
**Creating custom error types?** → ErrorHandling.md (Structured Error Types)
**Building services with dependencies?** → EffectLibraryDevelopment.md (Layer Composition)
**Need quick reminder?** → QuickReference.md (one-page cheat sheet)

## 🔧 HOW TO USE

### For Development

1. **Before implementing** - Check relevant patterns for established approaches
2. **During implementation** - Use patterns as templates for consistency
3. **When stuck** - Reference similar implementations in codebase following these patterns

### For Code Reviews

1. **Validate pattern compliance** - Ensure implementations follow established patterns
2. **Identify anti-patterns** - Look for forbidden practices (try-catch in Effect.gen, type assertions)
3. **Suggest patterns** - Recommend appropriate patterns for specific use cases

## 🚨 CRITICAL PRINCIPLES

### Forbidden Patterns (NEVER USE)

- **try-catch in Effect.gen**: Breaks Effect's error handling semantics
- **Type assertions**: `as any`, `as never`, `as unknown` hide type errors
- **Unsafe patterns**: Any pattern that bypasses Effect's type safety

### Mandatory Patterns (ALWAYS USE)

- **return yield\* for errors**: Makes termination explicit in generators
- **TestClock for time**: Use TestClock for any time-dependent tests
- **Data.TaggedError**: Use for all custom error types

## 📈 PATTERN QUALITY METRICS

### Completeness

- [ ] Core concepts clearly explained
- [ ] Executable code examples provided
- [ ] Common use cases covered
- [ ] Integration patterns documented

### Accuracy

- [ ] All examples compile and run correctly
- [ ] Patterns follow current Effect library conventions
- [ ] No deprecated or anti-pattern usage
- [ ] Proper error handling demonstrated

### Clarity

- [ ] Clear explanations for "why" not just "how"
- [ ] Progressive complexity (simple to advanced examples)
- [ ] Common pitfalls identified and explained
- [ ] Best practices highlighted

## 🔄 MAINTENANCE

### Regular Updates

- **API Changes**: Update patterns when Effect library APIs evolve
- **New Patterns**: Add patterns for newly identified common use cases
- **Deprecation**: Mark outdated patterns and provide migration paths
- **Examples**: Keep examples current with latest library versions

### Quality Assurance

- **Pattern Validation**: Regularly test all code examples
- **Consistency**: Ensure patterns align with current codebase standards
- **Documentation**: Keep pattern documentation synchronized with implementation

## 🎯 SUCCESS INDICATORS

### Developer Experience

- Reduced time to implement common patterns
- Consistent code quality across the codebase
- Fewer pattern-related code review comments
- Improved onboarding for new contributors

### Code Quality

- Consistent architecture patterns throughout codebase
- Proper error handling and resource management
- Type-safe implementations without workarounds
- Comprehensive test coverage with proper patterns

### Documentation Quality

- Practical, working examples for all patterns
- Clear guidance on when and how to use each pattern
- Integration examples showing pattern composition
- Anti-pattern identification and alternatives

This patterns directory serves as the authoritative guide for Effect library development, ensuring consistent, high-quality implementations across the entire codebase.
