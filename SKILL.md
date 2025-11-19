# Claude Skills Best Practices

## 🎯 PURPOSE

This document provides comprehensive guidance for creating, organizing, and managing Claude Skills for effect-start and similar projects.

## 📋 TABLE OF CONTENTS

- [What are Skills?](#what-are-skills)
- [When to Create a Skill](#when-to-create-a-skill)
- [Skill Structure](#skill-structure)
- [Creating Skills](#creating-skills)
- [Skill Patterns](#skill-patterns)
- [Testing Skills](#testing-skills)
- [Managing Skills](#managing-skills)
- [Examples](#examples)

---

## 🤔 WHAT ARE SKILLS?

**Claude Skills** are organized folders containing instructions, scripts, and resources that agents can discover and load dynamically. They extend Claude's capabilities by packaging expertise into composable, reusable components.

### Key Characteristics

1. **Modular**: Self-contained packages of functionality
2. **Discoverable**: Claude can find and load them as needed
3. **Composable**: Can be combined with other skills
4. **Reusable**: Work across different projects and contexts
5. **Specialized**: Focus on specific domains or tasks

### Skills vs. General Instructions

| Aspect | General Instructions (CLAUDE.md) | Skills |
|--------|----------------------------------|--------|
| Scope | Always active, project-wide | Loaded on-demand for specific tasks |
| Size | Large, comprehensive | Small, focused |
| Context | Full project context | Domain-specific context |
| Usage | All interactions | Specific workflows |
| Maintenance | Single file | Multiple focused files |

---

## 🎬 WHEN TO CREATE A SKILL

Create a skill when:

### ✅ Create a Skill If:

1. **Specialized Domain Knowledge**
   - Task requires specific expertise (e.g., database migrations, API design)
   - Knowledge is too detailed for general instructions
   - Example: "PostgreSQL optimization skill"

2. **Reusable Workflow**
   - Same sequence of steps repeated across projects
   - Can be templated and parameterized
   - Example: "Feature implementation workflow skill"

3. **Tool-Specific Expertise**
   - Requires deep knowledge of a specific tool
   - Multiple commands or configurations involved
   - Example: "Docker containerization skill"

4. **Context Management**
   - General instructions becoming too large
   - Reduces cognitive load on the agent
   - Example: "Testing patterns skill"

5. **Cross-Project Applicability**
   - Pattern useful across multiple projects
   - Can be shared with team or community
   - Example: "Effect error handling skill"

### ❌ Don't Create a Skill If:

1. **Simple One-Off Task**
   - Single command or simple operation
   - No repeated usage expected
   - Example: "Delete unused file"

2. **Project-Specific Logic**
   - Tightly coupled to one project
   - Not reusable elsewhere
   - Better in CLAUDE.md

3. **Always-Needed Context**
   - Required for every interaction
   - Should be in general instructions
   - Example: "Project directory structure"

4. **Trivial Operations**
   - Common knowledge for the model
   - No special expertise required
   - Example: "Create a variable"

---

## 📁 SKILL STRUCTURE

### Recommended Directory Structure

```
.claude/
└── skills/
    ├── README.md                    # Skills index and usage guide
    ├── database-migration/
    │   ├── skill.md                 # Skill instructions
    │   ├── templates/
    │   │   ├── migration.template.sql
    │   │   └── rollback.template.sql
    │   ├── examples/
    │   │   └── user-table-migration.md
    │   └── scripts/
    │       └── validate-migration.sh
    ├── api-endpoint/
    │   ├── skill.md
    │   ├── templates/
    │   │   ├── route-handler.template.ts
    │   │   └── route-test.template.ts
    │   └── examples/
    │       └── user-endpoint.md
    └── effect-testing/
        ├── skill.md
        ├── templates/
        │   ├── effect-test.template.ts
        │   └── testclock-test.template.ts
        └── examples/
            └── async-operation-test.md
```

### Skill File Structure (skill.md)

```markdown
# [Skill Name]

## 🎯 PURPOSE
Brief description of what this skill does and when to use it.

## 🎪 ACTIVATION
When this skill should be loaded (trigger phrases, contexts).

## 📋 PREREQUISITES
- Required tools
- Required knowledge
- Required project setup

## 🔧 CAPABILITIES
List of what the agent can do with this skill.

## 📐 WORKFLOW
Step-by-step process for using this skill.

## 📚 TEMPLATES
Available templates and how to use them.

## 💡 EXAMPLES
Concrete examples of skill usage.

## ⚠️ CONSTRAINTS
Limitations and boundaries for this skill.

## ✅ SUCCESS CRITERIA
How to know the skill was used successfully.

## 🔗 REFERENCES
Related documentation and resources.
```

---

## 🛠️ CREATING SKILLS

### Step-by-Step Skill Creation

#### 1. Define the Skill

```markdown
## Planning Questions

1. **What problem does this skill solve?**
   - Be specific about the use case
   - Identify the pain point it addresses

2. **Who will use this skill?**
   - What level of expertise do they have?
   - What context will they be working in?

3. **What are the inputs and outputs?**
   - What information does the skill need?
   - What does it produce?

4. **What tools/resources are needed?**
   - External tools or APIs
   - File templates
   - Documentation references

5. **How will success be measured?**
   - What's the expected outcome?
   - How to validate correctness?
```

#### 2. Create the Directory Structure

```bash
# Create skill directory
mkdir -p .claude/skills/my-skill/{templates,examples,scripts}

# Create main skill file
touch .claude/skills/my-skill/skill.md

# Create supporting files
touch .claude/skills/my-skill/templates/example.template.ts
touch .claude/skills/my-skill/examples/usage-example.md
```

#### 3. Write the Skill Instructions

```markdown
# My Skill Name

## 🎯 PURPOSE

[Clear, concise description of what this skill does]

This skill helps you [specific benefit] by providing [specific capability].

## 🎪 ACTIVATION

Activate this skill when:
- User mentions [trigger phrase 1]
- Task involves [specific context]
- Working with [specific technology]

## 📋 PREREQUISITES

Before using this skill, ensure:
- [ ] [Tool X] is installed
- [ ] [Configuration Y] is set up
- [ ] [Knowledge Z] is understood

## 🔧 CAPABILITIES

With this skill, you can:
1. [Capability 1] - [Brief description]
2. [Capability 2] - [Brief description]
3. [Capability 3] - [Brief description]

## 📐 WORKFLOW

### Standard Process

1. **Step 1: [Action]**
   - [Detailed instructions]
   - [Expected outcome]

2. **Step 2: [Action]**
   - [Detailed instructions]
   - [Expected outcome]

3. **Step 3: [Action]**
   - [Detailed instructions]
   - [Expected outcome]

### Validation Checkpoints

After each step, verify:
- [ ] [Checkpoint 1]
- [ ] [Checkpoint 2]
- [ ] [Checkpoint 3]

## 📚 TEMPLATES

### Template 1: [Name]

**Purpose**: [What this template is for]

**Location**: `templates/template1.template.ext`

**Usage**:
```
[How to use this template]
```

**Variables**:
- `{{VARIABLE1}}` - [Description]
- `{{VARIABLE2}}` - [Description]

## 💡 EXAMPLES

### Example 1: [Scenario]

**Context**: [Describe the situation]

**Input**:
```
[Example input]
```

**Process**:
1. [Step 1 with actual values]
2. [Step 2 with actual values]
3. [Step 3 with actual values]

**Output**:
```
[Example output]
```

## ⚠️ CONSTRAINTS

### Do's
- ✅ [What to do]
- ✅ [What to do]

### Don'ts
- ❌ [What not to do]
- ❌ [What not to do]

### Boundaries
- Only work within [scope]
- Always validate [specific thing]
- Never modify [protected area]

## ✅ SUCCESS CRITERIA

Task is complete when:
- [ ] [Criterion 1]
- [ ] [Criterion 2]
- [ ] [Criterion 3]

## 🔗 REFERENCES

- [Internal documentation](../patterns/related-pattern.md)
- [External resource](https://example.com)
```

#### 4. Create Templates

```typescript
// templates/example.template.ts

/**
 * {{DESCRIPTION}}
 *
 * @module {{MODULE_NAME}}
 */

import * as Effect from "effect/Effect"
import * as Data from "effect/Data"

/**
 * {{ERROR_DESCRIPTION}}
 */
class {{ERROR_NAME}} extends Data.TaggedError("{{ERROR_NAME}}")<{
  readonly message: string
  readonly cause?: unknown
}> {}

/**
 * {{FUNCTION_DESCRIPTION}}
 *
 * @param {{PARAM_NAME}} - {{PARAM_DESCRIPTION}}
 * @returns {{RETURN_DESCRIPTION}}
 */
export const {{FUNCTION_NAME}} = (
  {{PARAM_NAME}}: {{PARAM_TYPE}}
): Effect.Effect<{{SUCCESS_TYPE}}, {{ERROR_NAME}}> =>
  Effect.gen(function*() {
    // Validate input
    if (!{{PARAM_NAME}}) {
      return yield* Effect.fail(
        new {{ERROR_NAME}}({
          message: "{{PARAM_NAME}} is required"
        })
      )
    }

    // Implementation
    // TODO: Add your logic here

    return {{RETURN_VALUE}}
  })
```

#### 5. Create Examples

```markdown
# Example: User Validation Implementation

## Context

Implementing input validation for user registration endpoint.

## Requirements

- Validate email format
- Validate password strength
- Return structured errors

## Implementation

### Step 1: Define Error Types

```typescript
class ValidationError extends Data.TaggedError("ValidationError")<{
  readonly field: string
  readonly message: string
}> {}
```

### Step 2: Implement Validation

```typescript
export const validateUser = (data: UserInput) =>
  Effect.gen(function*() {
    // Validate email
    if (!data.email.includes("@")) {
      return yield* Effect.fail(
        new ValidationError({
          field: "email",
          message: "Invalid email format"
        })
      )
    }

    // Validate password
    if (data.password.length < 8) {
      return yield* Effect.fail(
        new ValidationError({
          field: "password",
          message: "Password must be at least 8 characters"
        })
      )
    }

    return { email: data.email, password: data.password }
  })
```

### Step 3: Write Tests

```typescript
test.describe("validateUser", () => {
  test.it("should accept valid user data", async () => {
    const result = await Effect.runPromise(
      validateUser({ email: "user@example.com", password: "secure123" })
    )
    test.expect(result.email).toBe("user@example.com")
  })

  test.it("should reject invalid email", async () => {
    const result = await Effect.runPromiseExit(
      validateUser({ email: "invalid", password: "secure123" })
    )
    test.expect(result._tag).toBe("Failure")
  })
})
```

## Outcome

- ✅ Email validation implemented
- ✅ Password validation implemented
- ✅ Structured errors defined
- ✅ Tests written and passing
```

---

## 🎨 SKILL PATTERNS

### Pattern 1: Domain Expert Skill

**Use Case**: Provide deep expertise in a specific domain

```markdown
# PostgreSQL Optimization Skill

## 🎯 PURPOSE
Expert guidance for optimizing PostgreSQL queries and database performance.

## 🔧 CAPABILITIES
- Analyze EXPLAIN output
- Suggest index strategies
- Identify N+1 queries
- Recommend query rewrites
- Optimize table schemas

## 📐 WORKFLOW

### Performance Analysis
1. Run EXPLAIN ANALYZE on slow query
2. Identify bottlenecks (seq scans, sorting, etc.)
3. Suggest specific optimizations
4. Provide index recommendations
5. Validate improvements with benchmarks

### Index Strategy
1. Analyze query patterns
2. Identify frequently filtered/joined columns
3. Calculate index selectivity
4. Suggest composite indexes
5. Consider index maintenance cost
```

### Pattern 2: Workflow Automation Skill

**Use Case**: Automate multi-step processes

```markdown
# Feature Implementation Workflow Skill

## 🎯 PURPOSE
Automate the complete workflow for implementing new features with Effect.

## 📐 WORKFLOW

### Phase 1: Research
1. Search for similar implementations
2. Identify dependencies
3. Review relevant patterns
4. Create implementation plan

### Phase 2: Implementation
1. Create module file with types
2. Implement core logic with Effect.gen
3. Add error handling with Data.TaggedError
4. Run `tsc` to check compilation

### Phase 3: Testing
1. Create test file (*.test.ts)
2. Write unit tests for happy path
3. Write unit tests for error cases
4. Use TestClock for time-dependent tests
5. Run `bun test` to verify

### Phase 4: Validation
1. Run full test suite
2. Check type errors with `tsc`
3. Run linter
4. Verify documentation
```

### Pattern 3: Code Generation Skill

**Use Case**: Generate boilerplate code from templates

```markdown
# Effect Route Handler Generator Skill

## 🎯 PURPOSE
Generate type-safe route handlers following Effect patterns.

## 🔧 CAPABILITIES
- Generate route handler boilerplate
- Create request/response schemas
- Add error handling
- Generate tests

## 📐 WORKFLOW

1. **Gather Requirements**
   - Route path
   - HTTP method
   - Request schema
   - Response schema
   - Error cases

2. **Generate Handler**
   - Use route-handler.template.ts
   - Fill in schemas
   - Add error handling
   - Include JSDoc comments

3. **Generate Tests**
   - Use route-test.template.ts
   - Add test cases for success
   - Add test cases for errors
   - Add validation tests

4. **Validate**
   - Run tsc
   - Run tests
   - Check linter
```

### Pattern 4: Code Review Skill

**Use Case**: Provide specialized code reviews

```markdown
# Effect Code Review Skill

## 🎯 PURPOSE
Review Effect-based code for correctness, safety, and best practices.

## 🔧 REVIEW CHECKLIST

### Type Safety
- [ ] No `any` types used
- [ ] Explicit return types on public functions
- [ ] Error channel properly typed
- [ ] No type assertions (as any, as never)

### Effect Patterns
- [ ] Effect.gen used for composition
- [ ] return yield* for terminal effects
- [ ] Data.TaggedError for custom errors
- [ ] No try-catch in Effect.gen

### Error Handling
- [ ] All error cases handled
- [ ] Errors include context information
- [ ] Proper error transformation
- [ ] Recovery strategies implemented

### Testing
- [ ] Tests exist for happy path
- [ ] Tests exist for error cases
- [ ] TestClock used for time-dependent tests
- [ ] 80%+ code coverage

### Resource Safety
- [ ] acquireUseRelease for resources
- [ ] No resource leaks
- [ ] Proper cleanup on errors
- [ ] Interruption handled correctly
```

---

## 🧪 TESTING SKILLS

### Testing Workflow

1. **Manual Testing**
   ```markdown
   Test skill with sample prompts:
   - "Implement a new feature for user authentication"
   - "Optimize this database query: SELECT * FROM users"
   - "Review this Effect code for best practices"
   ```

2. **Validation Checklist**
   - [ ] Skill loads successfully
   - [ ] Instructions are clear and unambiguous
   - [ ] Examples work as documented
   - [ ] Templates are valid and complete
   - [ ] Produces expected output
   - [ ] Handles edge cases appropriately

3. **Refinement**
   - Identify gaps or confusion
   - Add missing examples
   - Clarify ambiguous instructions
   - Update templates based on usage

### Testing Script Example

```bash
#!/bin/bash
# scripts/test-skill.sh

echo "Testing Database Migration Skill..."

# Test 1: Template validation
echo "Validating templates..."
for template in templates/*.template.*; do
  echo "Checking $template"
  # Add validation logic
done

# Test 2: Example execution
echo "Testing examples..."
# Add example execution logic

# Test 3: Constraint verification
echo "Verifying constraints..."
# Add constraint checking logic

echo "All tests passed!"
```

---

## 📊 MANAGING SKILLS

### Skills Registry

Create a registry to track available skills:

```markdown
# Skills Registry

## Available Skills

### Development
- `effect-testing` - Patterns for testing Effect-based code
- `api-endpoint` - Generate API endpoints with Effect
- `error-handling` - Implement structured error handling

### Database
- `migration` - Database migration workflow
- `optimization` - Query optimization guidance

### DevOps
- `docker` - Containerization patterns
- `deployment` - Deployment workflows

## Usage

To use a skill, mention its name in your request:
"Use the effect-testing skill to help me test this code"
```

### Version Control

```markdown
# Skill Versioning

Each skill should have version information:

## Skill Header
```markdown
# Skill Name
**Version**: 1.2.0
**Last Updated**: 2025-11-19
**Author**: Development Team
**Status**: Stable

## Changelog
- 1.2.0 (2025-11-19): Added examples for async operations
- 1.1.0 (2025-10-15): Improved error handling patterns
- 1.0.0 (2025-09-01): Initial release
```

### Maintenance Schedule

```markdown
## Skill Maintenance

### Weekly
- Review usage patterns
- Collect feedback
- Fix urgent issues

### Monthly
- Update examples
- Refine instructions
- Add new templates

### Quarterly
- Major version updates
- Add new capabilities
- Archive deprecated skills

### Annually
- Comprehensive review
- Consolidate related skills
- Update architecture
```

---

## 📚 EXAMPLES

### Example 1: Complete Testing Skill

```markdown
# Effect Testing Skill

**Version**: 1.0.0
**Last Updated**: 2025-11-19
**Author**: Development Team

## 🎯 PURPOSE

Provides comprehensive testing patterns for Effect-based code, including
proper use of TestClock, error testing, and resource management testing.

## 🎪 ACTIVATION

Activate this skill when:
- Writing tests for Effect code
- User mentions "test" + "Effect"
- Working with async/concurrent operations
- Testing error handling

## 📋 PREREQUISITES

- Bun test runner installed
- Effect library in project
- Understanding of Effect.gen

## 🔧 CAPABILITIES

1. **Basic Effect Testing** - Test Effect programs with Effect.runPromise
2. **Error Testing** - Test error cases with Effect.exit
3. **Time Testing** - Test time-dependent code with TestClock
4. **Resource Testing** - Test resource acquisition and cleanup
5. **Concurrent Testing** - Test concurrent operations and fibers

## 📐 WORKFLOW

### Standard Test Writing Process

1. **Import Dependencies**
   ```typescript
   import * as test from "bun:test"
   import * as Effect from "effect/Effect"
   import * as TestClock from "effect/TestClock"
   ```

2. **Write Test Structure**
   ```typescript
   test.describe("ModuleName", () => {
     test.it("should do something", async () => {
       // Test implementation
     })
   })
   ```

3. **Implement Test Logic**
   - Use Effect.gen for complex tests
   - Use TestClock for time-dependent tests
   - Use Effect.exit for error testing

4. **Run and Validate**
   ```bash
   bun test path/to/test.ts
   ```

## 📚 TEMPLATES

### Template 1: Basic Effect Test

**Location**: `templates/basic-effect-test.template.ts`

```typescript
import * as test from "bun:test"
import * as Effect from "effect/Effect"
import * as {{MODULE}} from "./{{MODULE}}.ts"

test.describe("{{MODULE}}", () => {
  test.it("{{TEST_DESCRIPTION}}", async () => {
    const program = Effect.gen(function*() {
      const result = yield* {{MODULE}}.{{FUNCTION}}({{ARGS}})
      return result
    })

    const result = await Effect.runPromise(program)
    test.expect(result).toBe({{EXPECTED}})
  })
})
```

### Template 2: Error Testing

**Location**: `templates/error-test.template.ts`

```typescript
test.it("should handle {{ERROR_CASE}}", async () => {
  const program = Effect.gen(function*() {
    const exit = yield* Effect.exit(
      {{MODULE}}.{{FUNCTION}}({{INVALID_ARGS}})
    )

    if (exit._tag === "Failure") {
      // Verify error type and content
      test.expect({{ERROR_CLASS}}.is{{ERROR_CLASS}}(exit.cause)).toBe(true)
    } else {
      test.fail("Expected operation to fail")
    }
  })

  await Effect.runPromise(program)
})
```

### Template 3: TestClock Testing

**Location**: `templates/testclock-test.template.ts`

```typescript
test.it("should handle time-dependent operation", async () => {
  const program = Effect.gen(function*() {
    // Start operation that involves time
    const fiber = yield* Effect.fork(
      {{MODULE}}.{{TIMED_FUNCTION}}({{ARGS}})
    )

    // Advance test clock
    yield* TestClock.adjust("{{DURATION}}")

    // Check result
    const result = yield* Effect.Fiber.join(fiber)
    return result
  })

  const result = await Effect.runPromise(program)
  test.expect(result).toBe({{EXPECTED}})
})
```

## 💡 EXAMPLES

### Example 1: Testing Async Operation

**Context**: Testing a function that fetches data with retry logic

```typescript
import * as test from "bun:test"
import * as Effect from "effect/Effect"
import * as TestClock from "effect/TestClock"
import * as UserService from "./UserService.ts"

test.describe("UserService", () => {
  test.it("should fetch user with retry", async () => {
    const program = Effect.gen(function*() {
      // Mock the fetch to fail twice, then succeed
      let attempts = 0
      const mockFetch = () => {
        attempts++
        if (attempts < 3) {
          return Effect.fail(new NetworkError({ status: 503 }))
        }
        return Effect.succeed({ id: "1", name: "John" })
      }

      // Start the operation
      const fiber = yield* Effect.fork(
        UserService.getUser("1").pipe(
          Effect.retry(Schedule.exponential("100 millis", 2.0))
        )
      )

      // Advance clock for retries
      yield* TestClock.adjust("100 millis") // First retry
      yield* TestClock.adjust("200 millis") // Second retry

      // Get result
      const result = yield* Effect.Fiber.join(fiber)
      return result
    })

    const result = await Effect.runPromise(program)
    test.expect(result.name).toBe("John")
  })
})
```

### Example 2: Testing Error Handling

```typescript
test.describe("UserService validation", () => {
  test.it("should fail on invalid user ID", async () => {
    const program = Effect.gen(function*() {
      const exit = yield* Effect.exit(
        UserService.getUser("")
      )

      if (exit._tag === "Failure") {
        const error = exit.cause
        test.expect(ValidationError.isValidationError(error)).toBe(true)
        if (ValidationError.isValidationError(error)) {
          test.expect(error.field).toBe("userId")
        }
      } else {
        test.fail("Expected validation to fail")
      }
    })

    await Effect.runPromise(program)
  })
})
```

## ⚠️ CONSTRAINTS

### Do's
- ✅ Always use TestClock for time-dependent tests
- ✅ Test both success and error paths
- ✅ Use Effect.exit for error testing
- ✅ Test edge cases and boundaries
- ✅ Use descriptive test names

### Don'ts
- ❌ Never use setTimeout in tests
- ❌ Never use real time delays
- ❌ Never skip error case testing
- ❌ Never use catch blocks in tests
- ❌ Never ignore test failures

### Boundaries
- Only test public API functions
- Always clean up test resources
- Keep tests isolated and independent
- Each test should be runnable alone

## ✅ SUCCESS CRITERIA

Tests are complete when:
- [ ] All public functions have tests
- [ ] Happy path is tested
- [ ] Error cases are tested
- [ ] Edge cases are covered
- [ ] Time-dependent code uses TestClock
- [ ] All tests pass
- [ ] Test coverage > 80%

## 🔗 REFERENCES

- [Effect Testing Documentation](https://effect.website/docs/testing)
- [Bun Test Runner](https://bun.sh/docs/cli/test)
- [TestClock Guide](https://effect.website/docs/testing/testclock)
- [Project Testing Patterns](../../.patterns/testing.md)
```

---

## ✅ SKILL CREATION CHECKLIST

Use this checklist when creating a new skill:

### Planning
- [ ] Clear purpose defined
- [ ] Use cases identified
- [ ] Prerequisites documented
- [ ] Success criteria established

### Structure
- [ ] Directory created with proper structure
- [ ] skill.md file created
- [ ] Templates directory with templates
- [ ] Examples directory with examples
- [ ] Scripts directory (if needed)

### Content
- [ ] Purpose section complete
- [ ] Activation conditions clear
- [ ] Prerequisites listed
- [ ] Capabilities documented
- [ ] Workflow steps detailed
- [ ] Templates provided
- [ ] Examples included
- [ ] Constraints defined
- [ ] Success criteria specified

### Quality
- [ ] Instructions are clear and unambiguous
- [ ] Examples are complete and working
- [ ] Templates are valid
- [ ] No contradictory requirements
- [ ] Consistent terminology

### Testing
- [ ] Manually tested with sample tasks
- [ ] Examples verified
- [ ] Templates validated
- [ ] Edge cases considered

### Documentation
- [ ] Added to skills registry
- [ ] Version information included
- [ ] Related references linked
- [ ] Maintenance plan defined

---

**Version**: 1.0.0
**Last Updated**: 2025-11-19
**Maintainer**: Development Team
