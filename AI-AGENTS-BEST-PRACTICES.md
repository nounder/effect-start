# AI Agents Best Practices

## 🎯 PURPOSE

This document provides universal best practices for creating effective AI agent instructions, applicable to any codebase or project. For project-specific guidelines, see `CLAUDE.md`.

## 📋 TABLE OF CONTENTS

- [Core Principles](#core-principles)
- [Instruction Structure](#instruction-structure)
- [Prompt Engineering](#prompt-engineering)
- [Agent Specialization](#agent-specialization)
- [Security & Permissions](#security--permissions)
- [Testing & Validation](#testing--validation)
- [Common Pitfalls](#common-pitfalls)
- [Examples](#examples)

---

## 🎯 CORE PRINCIPLES

### 1. Clarity Over Brevity

**Principle**: Explicit instructions are better than implicit expectations.

```markdown
❌ BAD: Make the code better
✅ GOOD: Refactor the authentication module to:
- Use TypeScript strict mode
- Add input validation for all public functions
- Write unit tests with 80%+ coverage
- Follow the error handling patterns in .patterns/error-handling.md
```

### 2. Specificity Over Generality

**Principle**: Provide specific guidelines for your domain rather than generic advice.

```markdown
❌ BAD: Write good code
✅ GOOD: Follow Effect library conventions:
- Use Effect.gen for monadic composition
- Use Data.TaggedError for custom error types
- Never use try-catch in Effect.gen generators
```

### 3. Examples Over Explanations

**Principle**: Show don't tell - provide concrete examples of correct and incorrect patterns.

```markdown
❌ BAD: Use proper error handling
✅ GOOD:
// ❌ WRONG
function process(data) {
  return data.map(x => x.value)
}

// ✅ CORRECT
function process(data: readonly Data[]): Effect.Effect<Value[], ParseError> {
  return Effect.gen(function*() {
    return yield* Effect.forEach(data, item =>
      Effect.mapError(parseValue(item), error =>
        new ParseError({ cause: error })
      )
    )
  })
}
```

### 4. Constraints Over Freedom

**Principle**: Define what NOT to do is as important as defining what to do.

```markdown
## 🚨 FORBIDDEN PATTERNS

### NEVER: Type Assertions
- `as any`, `as never`, `as unknown` break type safety
- Always fix underlying type issues

### NEVER: Unvalidated External Input
- All user input must be validated at boundaries
- Use proper parsing and validation libraries
```

---

## 📐 INSTRUCTION STRUCTURE

### Recommended Template

Use this template as a starting point for your agent instructions:

```markdown
# [Project Name] Agent Instructions

## 🎯 ROLE & GOAL
[Define the agent's primary role and objectives]

## 🚨 CRITICAL RULES
[Highest priority rules that must NEVER be violated]

### FORBIDDEN PATTERNS
[What the agent must never do]

### MANDATORY PATTERNS
[What the agent must always do]

## 📋 WORKFLOW
[Step-by-step process for common tasks]

## 🎨 CODE STYLE
[Language-specific and project-specific style guidelines]

## 🧪 TESTING
[Testing requirements and patterns]

## 🔧 TOOLS & COMMANDS
[Available tools and when to use them]

## 📚 REFERENCES
[Links to relevant documentation and patterns]

## ✅ SUCCESS CRITERIA
[How to know when a task is complete]

## 🚫 GUARDRAILS
[Safety constraints and boundaries]
```

### Section Guidelines

#### Role & Goal

Define the agent's identity and purpose clearly:

```markdown
## 🎯 ROLE & GOAL

You are an expert TypeScript developer specializing in Effect-based
applications. Your goal is to write type-safe, functional code that
follows Effect library conventions and maintains zero compilation errors.

**Core Responsibilities:**
- Implement features using Effect patterns
- Write comprehensive tests for all code
- Maintain strict type safety
- Follow established architectural patterns
```

#### Critical Rules

Use visual hierarchy to emphasize importance:

```markdown
## 🚨 CRITICAL RULES

### ABSOLUTELY FORBIDDEN: try-catch in Effect.gen

**NEVER use `try-catch` blocks inside `Effect.gen` generators!**

- Effect generators handle errors through the Effect type system
- **CRITICAL**: This will cause runtime errors
- **EXAMPLE OF WHAT NOT TO DO**: [code example]
- **CORRECT PATTERN**: [code example]
```

#### Workflow

Provide step-by-step processes for common tasks:

```markdown
## 📋 WORKFLOW

### When Implementing a New Feature

1. **Research Phase**
   - Read existing similar implementations
   - Identify dependencies and integration points
   - Review test patterns for the module

2. **Planning Phase**
   - Create detailed implementation plan
   - Identify validation checkpoints
   - Consider edge cases and error scenarios

3. **Implementation Phase**
   - Write function signature and types first
   - Implement core logic
   - Run `tsc` to check compilation
   - Write tests
   - Run tests to verify functionality
   - Run linter and formatters

4. **Validation Phase**
   - All tests must pass
   - Zero type errors
   - Code follows style guidelines
   - Documentation is complete
```

#### Guardrails

Define boundaries and safety constraints:

```markdown
## 🚫 GUARDRAILS

### Security
- NEVER commit files containing secrets (.env, credentials.json)
- ALWAYS validate user input at boundaries
- NEVER execute arbitrary code from user input

### Permissions
- NEVER modify files outside the project directory
- ALWAYS ask before running destructive operations
- NEVER push to main/master without confirmation

### Scope
- Stay focused on the assigned task
- Ask for clarification when requirements are ambiguous
- Don't implement features not explicitly requested
```

---

## 🎨 PROMPT ENGINEERING

### Effective Prompt Patterns

#### 1. Chain-of-Thought Prompting

Encourage step-by-step reasoning:

```markdown
When implementing a complex feature:
1. First, analyze the existing codebase structure
2. Then, identify the integration points
3. Next, draft an implementation plan
4. Finally, implement incrementally with validation at each step

Before writing code, explain your reasoning and approach.
```

#### 2. Few-Shot Learning

Provide examples of desired behavior:

```markdown
## Examples

### Example 1: Adding a New Route Handler

**Scenario**: User requests a new API endpoint for user profile

**Correct Approach**:
1. Read existing route handlers in `src/routes/`
2. Identify the pattern used (Effect.gen, error handling, etc.)
3. Create new route file following the pattern
4. Write tests following co-located test pattern
5. Validate with `tsc && bun test`

### Example 2: Fixing a Type Error

**Scenario**: Type error in Effect composition

**Correct Approach**:
1. Analyze the error message to understand the type mismatch
2. Check the Effect documentation for the correct type signature
3. Fix the issue by adjusting type parameters, not using type assertions
4. Verify fix with `tsc`
```

#### 3. Role-Based Prompting

Define specific roles for different tasks:

```markdown
## Task-Specific Roles

### When Writing Tests
You are a meticulous QA engineer focused on comprehensive test coverage.
- Test happy paths and edge cases
- Use descriptive test names
- Verify error conditions
- Use TestClock for time-dependent tests

### When Refactoring
You are a careful architect focused on maintainability.
- Preserve existing behavior
- Improve code structure incrementally
- Add tests before refactoring
- Run full test suite after changes

### When Debugging
You are a systematic debugger focused on root cause analysis.
- Reproduce the issue first
- Use logging and debugging tools
- Test hypotheses incrementally
- Document findings and solutions
```

#### 4. Constraint-Based Prompting

Define clear boundaries:

```markdown
## Constraints

### Technical Constraints
- TypeScript strict mode must be enabled
- All functions must have explicit return types
- Effect error channel must be typed
- No `any` types allowed

### Process Constraints
- Run tests after every code change
- Check types before committing
- Follow git commit message conventions
- Update documentation with code changes

### Domain Constraints
- Follow Effect library conventions
- Use Data.TaggedError for custom errors
- Implement resource safety patterns
- Handle all error cases explicitly
```

---

## 🔧 AGENT SPECIALIZATION

### When to Create Specialized Agents

Create specialized agents when:

1. **Task complexity** requires focused expertise
2. **Context size** for a general agent becomes too large
3. **Permission boundaries** differ between tasks
4. **Domain knowledge** is highly specialized
5. **Tool sets** are distinct for different tasks

### Specialization Patterns

#### Pattern 1: Task-Specific Agents

```markdown
## Agent Types

### code-writer
- **Purpose**: Implement new features and functionality
- **Tools**: Read, Write, Edit, Bash (for tsc)
- **Constraints**: Must write tests, must check types
- **Context**: Full access to codebase

### test-runner
- **Purpose**: Run tests and report results
- **Tools**: Read, Bash (for test commands)
- **Constraints**: Read-only access, no code modifications
- **Context**: Test files and results only

### code-reviewer
- **Purpose**: Review code for quality and correctness
- **Tools**: Read, Grep, Glob
- **Constraints**: Read-only access, no modifications
- **Context**: Changed files and related code only
```

#### Pattern 2: Layer-Based Agents

```markdown
## Agent Layers

### L1: Research Agent
- Explores codebase to gather information
- Uses Glob, Grep, Read tools
- Produces analysis and recommendations
- No write permissions

### L2: Planning Agent
- Takes research output and creates implementation plan
- Identifies dependencies and risks
- Defines validation checkpoints
- No write permissions

### L3: Implementation Agent
- Executes the plan from L2 agent
- Has write permissions
- Must follow plan and validation checkpoints
- Reports progress and blockers
```

### Agent Composition

Example of composing multiple agents:

```markdown
## Multi-Agent Workflow

When user requests: "Add authentication to the API"

1. **Launch Research Agent**
   - Find existing authentication patterns
   - Identify security requirements
   - Report findings

2. **Launch Planning Agent**
   - Take research findings
   - Create implementation plan with:
     * Module structure
     * Test strategy
     * Integration points
     * Security considerations

3. **Launch Implementation Agent**
   - Execute plan step-by-step
   - Write code and tests
   - Run validations at each checkpoint

4. **Launch Review Agent**
   - Review implemented code
   - Check for security issues
   - Verify test coverage
   - Suggest improvements
```

---

## 🔒 SECURITY & PERMISSIONS

### Permission Principles

#### 1. Principle of Least Privilege

Start with minimal permissions and add only what's needed:

```markdown
## Agent Permissions

### read-agent
**Allowed:**
- Read any file in project
- Run read-only commands (ls, cat, grep)

**Denied:**
- Write to any file
- Execute commands that modify state
- Network access

### write-agent
**Allowed:**
- Read any file in project
- Write to source and test directories
- Run build and test commands

**Denied:**
- Write to .git directory
- Modify configuration files without confirmation
- Push to remote without confirmation
```

#### 2. Explicit Confirmations

Require user confirmation for sensitive operations:

```markdown
## Confirmation Requirements

### Always Ask Before:
- Pushing to remote repository
- Modifying configuration files (.env, package.json, tsconfig.json)
- Running commands with --force flags
- Deleting files or directories
- Making breaking changes to public APIs

### Pattern:
Before performing [sensitive operation], respond with:
"I'm about to [describe operation in detail]. This will:
- [Effect 1]
- [Effect 2]
- [Effect 3]

Do you want me to proceed? (yes/no)"
```

#### 3. Secure Defaults

Configure agents with security by default:

```markdown
## Security Defaults

### File Operations
- Never commit files matching .gitignore patterns
- Warn if secrets detected in files (API keys, passwords, tokens)
- Validate file paths before operations

### Command Execution
- Escape shell arguments properly
- Validate commands before execution
- Log all commands for audit trail

### Network Operations
- Only allow HTTPS connections
- Validate URLs before fetching
- Timeout after reasonable duration
```

### Security Checklist

```markdown
## Security Validation Checklist

Before deploying agent instructions, verify:

- [ ] All sensitive operations require confirmation
- [ ] File write permissions are scoped appropriately
- [ ] Command execution is validated and logged
- [ ] Secrets detection is configured
- [ ] Network access is restricted to necessary domains
- [ ] Error messages don't leak sensitive information
- [ ] Audit logging is enabled for critical operations
```

---

## 🧪 TESTING & VALIDATION

### Test-Driven Agent Development

#### Pattern 1: Write Tests First

```markdown
## Test-First Development

When implementing new agent behaviors:

1. **Define Expected Behavior**
   - Write test cases describing desired output
   - Include edge cases and error scenarios
   - Document assumptions

2. **Implement Behavior**
   - Write agent instructions
   - Test with sample inputs
   - Iterate until tests pass

3. **Validate**
   - Run comprehensive test suite
   - Verify edge cases
   - Check error handling
```

#### Pattern 2: Validation Checkpoints

```markdown
## Mandatory Validation Points

### After Writing Code
- [ ] Run type checker: `tsc --noEmit`
- [ ] Run linter: `npm run lint`
- [ ] Run formatter: `npm run format`
- [ ] Run tests: `npm test`

### Before Committing
- [ ] All tests pass
- [ ] Zero type errors
- [ ] Zero linter errors
- [ ] Code is formatted
- [ ] Commit message follows convention

### Before Pushing
- [ ] Full test suite passes
- [ ] Build succeeds
- [ ] Documentation is updated
- [ ] Breaking changes are documented
```

### Agent Testing Strategies

#### 1. Unit Testing Agent Behaviors

```typescript
describe("Agent Instructions", () => {
  it("should follow forbidden patterns list", async () => {
    const code = await agent.generateCode(prompt)

    // Verify no forbidden patterns
    expect(code).not.toContain("as any")
    expect(code).not.toContain("as never")
    expect(code).not.toMatch(/try\s*{\s*yield/)
  })

  it("should use mandatory patterns", async () => {
    const code = await agent.generateErrorHandling(prompt)

    // Verify mandatory patterns present
    expect(code).toContain("return yield* Effect.fail")
    expect(code).toMatch(/Data\.TaggedError/)
  })
})
```

#### 2. Integration Testing Agent Workflows

```typescript
describe("Agent Workflow", () => {
  it("should follow function development workflow", async () => {
    const result = await agent.implementFeature({
      description: "Add user validation function",
      checkpoints: ["compile", "test", "lint"]
    })

    expect(result.steps).toEqual([
      "Created function implementation",
      "Ran tsc - passed",
      "Wrote test file",
      "Ran tests - passed",
      "Ran linter - passed"
    ])
  })
})
```

---

## ⚠️ COMMON PITFALLS

### Pitfall 1: Vague Instructions

**Problem**: Instructions are too general to be actionable.

```markdown
❌ BAD:
"Make the code clean and maintainable"

✅ GOOD:
"Refactor using these specific criteria:
- Extract functions longer than 20 lines
- Add JSDoc comments to public functions
- Remove unused imports and variables
- Follow single responsibility principle
- Add unit tests for extracted functions"
```

### Pitfall 2: Missing Context

**Problem**: Agent lacks necessary context to make decisions.

```markdown
❌ BAD:
"Fix the bug in the authentication code"

✅ GOOD:
"Fix the authentication bug:
- Location: src/auth/login.ts:45
- Issue: Token expiration not handled
- Expected behavior: Refresh token when expired
- Current behavior: Returns 401 error
- Reference: See auth patterns in .patterns/auth.md
- Test: Verify with test in src/auth/login.test.ts"
```

### Pitfall 3: Unclear Success Criteria

**Problem**: No clear definition of "done".

```markdown
❌ BAD:
"Improve the performance"

✅ GOOD:
"Optimize database queries:
- Success criteria:
  * Query time < 100ms for user lookup
  * Batch queries reduced by 50%
  * Zero N+1 query patterns
  * All existing tests still pass
- Measurement: Use benchmark suite in /benchmarks
- Validation: Run `npm run benchmark` before and after"
```

### Pitfall 4: Permission Sprawl

**Problem**: Agent has excessive permissions leading to safety issues.

```markdown
❌ BAD:
"Agent has full system access"

✅ GOOD:
"Agent permissions:
- Read: Any file in /src and /test directories
- Write: Only files in /src and /test directories
- Execute: Only npm scripts defined in package.json
- Deny: .git directory, node_modules, .env files
- Confirm: Any operation affecting >10 files"
```

### Pitfall 5: Inconsistent Terminology

**Problem**: Using different terms for the same concept.

```markdown
❌ BAD:
- "error types" / "failure modes" / "exception classes"
- "test" / "spec" / "validation"
- "function" / "method" / "procedure"

✅ GOOD:
Use consistent terminology:
- "Error types" → Always use "Data.TaggedError"
- "Test files" → Always "*.test.ts"
- "Functions" → Always "function" (not "method" unless class method)

Define terms in glossary:
## Glossary
- **Effect**: A value representing a computation with error and context tracking
- **Generator**: Function* syntax used with Effect.gen
- **Layer**: Dependency injection container for services
```

---

## 📚 EXAMPLES

### Example 1: Complete Agent Instructions (Simple)

```markdown
# Calculator Agent Instructions

## 🎯 ROLE & GOAL
You are a calculator implementation assistant. Your goal is to implement
arithmetic operations with proper error handling and comprehensive tests.

## 🚨 CRITICAL RULES

### MANDATORY: Type Safety
- All functions must have explicit type signatures
- Use `Result<T, Error>` type for operations that can fail
- Never use `any` type

### MANDATORY: Test Coverage
- Every function must have at least 3 test cases
- Test happy path, edge cases, and error conditions

## 📋 WORKFLOW

1. **Implement Function**
   - Write type signature first
   - Implement logic with error handling
   - Run `tsc` to check types

2. **Write Tests**
   - Test valid inputs
   - Test invalid inputs (zero, NaN, etc.)
   - Test edge cases (Infinity, very large numbers)

3. **Validate**
   - `npm run test` - all tests must pass
   - `npm run lint` - zero errors
   - `npm run build` - builds successfully

## ✅ SUCCESS CRITERIA

A function is complete when:
- [x] Type safe (no `any`, explicit return type)
- [x] Error handling implemented
- [x] 3+ tests written and passing
- [x] Zero linter errors
- [x] Builds successfully

## 🚫 GUARDRAILS

- NEVER modify files outside /src and /test directories
- NEVER commit without running tests
- ALWAYS validate division by zero
- ALWAYS handle NaN and Infinity cases
```

### Example 2: Complete Agent Instructions (Complex)

```markdown
# API Integration Agent Instructions

## 🎯 ROLE & GOAL

You are an API integration specialist. Your role is to integrate external
APIs into Effect-based applications with proper error handling, retry logic,
and comprehensive testing.

## 🚨 CRITICAL RULES

### ABSOLUTELY FORBIDDEN

1. **Unhandled Network Errors**
   - NEVER let fetch errors propagate uncaught
   - ALWAYS use Effect.tryPromise with structured errors

2. **Missing Rate Limiting**
   - NEVER make unbounded API requests
   - ALWAYS implement rate limiting

3. **Exposing Secrets**
   - NEVER log API keys or tokens
   - ALWAYS use environment variables for secrets

### MANDATORY PATTERNS

1. **Structured Errors**
   ```typescript
   class ApiError extends Data.TaggedError("ApiError")<{
     status: number
     url: string
     body?: unknown
   }> {}
   ```

2. **Retry Logic**
   - Use exponential backoff
   - Max 3 retry attempts
   - Only retry on 5xx errors

3. **Request Validation**
   - Validate all inputs before sending
   - Sanitize user input
   - Use Zod schemas for response validation

## 📋 WORKFLOW

### When Integrating New API

1. **Research Phase**
   - Read API documentation
   - Identify authentication method
   - Check rate limits
   - Review error responses

2. **Planning Phase**
   - Define TypeScript types for requests/responses
   - Plan error handling strategy
   - Design retry logic
   - Plan test cases

3. **Implementation Phase**
   - Implement client configuration
   - Implement request functions with Effect.gen
   - Add error handling with Data.TaggedError
   - Implement retry logic with Schedule
   - Add request/response logging

4. **Testing Phase**
   - Write unit tests with mocked responses
   - Write integration tests with test API
   - Test error scenarios (timeouts, 4xx, 5xx)
   - Test retry logic with TestClock

5. **Validation Phase**
   - All tests pass (unit + integration)
   - Zero type errors
   - Secrets not committed
   - Rate limiting verified
   - Error handling complete

## 🎨 CODE PATTERNS

### API Client Structure

```typescript
// src/clients/ExternalApi.ts

import { Context, Data, Effect, Schedule } from "effect"

// Error types
class ApiError extends Data.TaggedError("ApiError")<{
  status: number
  url: string
  body?: unknown
}> {}

class NetworkError extends Data.TaggedError("NetworkError")<{
  url: string
  cause: unknown
}> {}

// Service interface
class ExternalApiClient extends Context.Tag("ExternalApiClient")<
  ExternalApiClient,
  {
    readonly getUser: (id: string) => Effect.Effect<User, ApiError | NetworkError>
  }
>() {}

// Implementation
export const make = (config: ApiConfig) =>
  ExternalApiClient.of({
    getUser: (id) =>
      Effect.gen(function*() {
        // Validate input
        if (!id) {
          return yield* Effect.fail(
            new ApiError({ status: 400, url: "/users", body: "ID required" })
          )
        }

        // Make request with retry
        const response = yield* Effect.tryPromise({
          try: () => fetch(`${config.baseUrl}/users/${id}`, {
            headers: { Authorization: `Bearer ${config.apiKey}` }
          }),
          catch: (error) => new NetworkError({
            url: `/users/${id}`,
            cause: error
          })
        }).pipe(
          Effect.retry(
            Schedule.exponential("100 millis").pipe(
              Schedule.compose(Schedule.recurs(3))
            )
          )
        )

        // Handle error responses
        if (!response.ok) {
          const body = yield* Effect.tryPromise({
            try: () => response.text(),
            catch: () => undefined
          })

          return yield* Effect.fail(
            new ApiError({
              status: response.status,
              url: response.url,
              body
            })
          )
        }

        // Parse response
        const data = yield* Effect.tryPromise({
          try: () => response.json(),
          catch: (error) => new ApiError({
            status: 500,
            url: response.url,
            body: "Failed to parse response"
          })
        })

        // Validate with Zod
        const user = yield* Effect.try({
          try: () => UserSchema.parse(data),
          catch: (error) => new ApiError({
            status: 500,
            url: response.url,
            body: "Invalid response schema"
          })
        })

        return user
      })
  })
```

## 🧪 TESTING REQUIREMENTS

### Unit Tests

```typescript
// src/clients/ExternalApi.test.ts

import * as test from "bun:test"
import * as Effect from "effect/Effect"
import * as ExternalApi from "./ExternalApi.ts"

test.describe("ExternalApi", () => {
  test.it("should fetch user successfully", async () => {
    // Test implementation
  })

  test.it("should handle 404 errors", async () => {
    // Test error handling
  })

  test.it("should retry on 503 errors", async () => {
    // Test retry logic with TestClock
  })
})
```

## ✅ SUCCESS CRITERIA

Integration is complete when:
- [x] All endpoints implemented with Effect.gen
- [x] Structured errors defined (ApiError, NetworkError)
- [x] Retry logic implemented with Schedule
- [x] Rate limiting implemented
- [x] Request/response validation with Zod
- [x] Unit tests (90%+ coverage)
- [x] Integration tests pass
- [x] Error scenarios tested
- [x] Secrets in environment variables
- [x] No secrets in logs or commits
- [x] Documentation complete

## 🚫 GUARDRAILS

### Security
- NEVER commit API keys or tokens
- NEVER log sensitive data (tokens, passwords, PII)
- ALWAYS use HTTPS for API requests
- ALWAYS validate and sanitize user input

### Reliability
- NEVER make unbounded requests (implement timeouts)
- ALWAYS implement retry logic for transient failures
- ALWAYS handle rate limiting (429 status)
- ALWAYS validate responses against schema

### Scope
- ONLY modify files in /src/clients and /test
- ASK before adding new dependencies
- CONFIRM before making breaking API changes
- REPORT any unexpected API behavior

## 📚 REFERENCES

- Effect documentation: https://effect.website
- API patterns: .patterns/api-integration.md
- Error handling: .patterns/error-handling.md
- Testing patterns: .patterns/testing.md
```

---

## 🔗 RELATED RESOURCES

### Official Documentation

- [Anthropic: Building Effective Agents](https://www.anthropic.com/research/building-effective-agents)
- [Anthropic: Agent Skills](https://docs.anthropic.com/en/docs/agents-and-tools/agent-skills/overview)
- [Anthropic: Claude Code Best Practices](https://www.anthropic.com/engineering/claude-code-best-practices)

### Internal Documentation

- `CLAUDE.md` - Project-specific agent instructions
- `SKILL.md` - Guide for creating Claude Skills
- `.patterns/` - Development patterns and best practices

---

## 📝 DOCUMENT MAINTENANCE

### When to Update This Document

- New best practices emerge from agent usage
- Common failure patterns are identified
- Security vulnerabilities are discovered
- Agent capabilities expand
- Project requirements change

### Review Schedule

- **Monthly**: Review for accuracy and completeness
- **Quarterly**: Update examples with latest patterns
- **Annually**: Major revision incorporating lessons learned

---

## ✅ CHECKLIST FOR CREATING AGENT INSTRUCTIONS

Use this checklist when creating new agent instructions:

### Structure
- [ ] Role and goal clearly defined
- [ ] Critical rules highlighted with 🚨
- [ ] Forbidden patterns documented with examples
- [ ] Mandatory patterns documented with examples
- [ ] Workflow steps clearly outlined
- [ ] Success criteria defined
- [ ] Guardrails established

### Content
- [ ] Instructions are specific, not vague
- [ ] Examples provided for complex patterns
- [ ] Code snippets are complete and correct
- [ ] Error handling patterns included
- [ ] Testing requirements specified
- [ ] Security considerations addressed

### Quality
- [ ] Consistent terminology throughout
- [ ] Clear hierarchy with headers and sections
- [ ] Visual markers (emojis, formatting) for emphasis
- [ ] Links to related documentation
- [ ] Realistic examples based on actual usage

### Validation
- [ ] Tested with sample tasks
- [ ] No ambiguous instructions
- [ ] No contradictory requirements
- [ ] Achievable with available tools
- [ ] Appropriate permission scope

---

**Version**: 1.0.0
**Last Updated**: 2025-11-19
**Maintainer**: Development Team
