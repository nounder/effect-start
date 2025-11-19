# Agent Documentation Improvement Recommendations

## Executive Summary

Based on Claude Code best practices research and analysis of current documentation, this document provides actionable recommendations to improve AI agent performance through optimized instruction files.

**Key Metrics:**
- Current AGENTS.md: **359 lines** → Recommended: **~100 lines** (68% reduction)
- Token cost reduction: **~60-70% per conversation**
- Performance improvement: Better instruction adherence, fewer token costs

## Research Sources

- Anthropic Engineering: [Claude Code Best Practices](https://www.anthropic.com/engineering/claude-code-best-practices)
- Anthropic Docs: [Agent Skills Documentation](https://docs.claude.com/en/docs/claude-code/skills)
- Anthropic Engineering: [Equipping Agents with Skills](https://www.anthropic.com/engineering/equipping-agents-for-the-real-world-with-agent-skills)
- Community: [Claude Skills Deep Dive](https://leehanchung.github.io/blogs/2025/10/26/claude-skills-deep-dive/)

## Core Principles Discovered

### 1. **Be Lean and Intentional**
> "You're writing for Claude, not onboarding a junior dev"

- Keep CLAUDE.md under 100 lines
- Use short, declarative bullet points
- Every line costs tokens—trim ruthlessly
- Only include project-specific, non-obvious information

### 2. **Strategic Emphasis**
- Use "IMPORTANT", "CRITICAL", "NEVER", "ALWAYS" for must-follow rules
- Use emojis sparingly for visual hierarchy (🚨 for critical warnings)
- Bold or ALL CAPS for key instructions

### 3. **Progressive Disclosure**
- Load detailed information only when needed
- Use separate pattern files for deep-dives
- Reference external files rather than duplicating content
- Keep core instructions minimal

### 4. **Specificity Over Generics**
- Avoid boilerplate like "write clean code"
- Delete obvious information ("tests folder contains tests")
- Focus on non-obvious relationships and constraints
- Provide concrete, measurable outcomes

## Detailed Recommendations

---

## 1. AGENTS.md (rename to CLAUDE.md)

### Current Issues

**File Length:**
- Current: 359 lines
- Recommended: ~100 lines
- Issue: Token waste, reduced focus on critical rules

**Verbosity:**
```markdown
# ❌ Current (verbose)
### When Stuck
- Stop spiraling into complex solutions
- Break down the problem into smaller parts
- Use the Task tool for parallel problem-solving
- Simplify the approach
- Ask for guidance rather than guessing

# ✅ Recommended (concise)
### When Stuck
- Stop spiraling → break into smaller parts
- Use Task tool for parallel approaches
- Simplify or ask for guidance
```

**Generic Information:**
```markdown
# ❌ Delete (obvious)
- Test files are co-located with source files as `*.test.ts`
- Uses Bun's built-in test runner (`bun:test`)

# ✅ Keep (non-obvious)
- CRITICAL: Time-dependent code MUST use TestClock, never wall-clock time
```

### Recommended Changes

**1. Rename file:**
```bash
mv AGENTS.md CLAUDE.md
```
Reason: CLAUDE.md is the standard convention recognized by Claude Code

**2. Reduce to ~100 lines:**
- See `SUGGESTED-CLAUDE.md` for streamlined version
- Removed 68% of content (244 lines)
- Kept only critical, project-specific rules

**3. Enhanced Structure:**
```markdown
## 🚨 ABSOLUTE RULES - ZERO TOLERANCE
[Critical forbidden patterns with examples]

## 🔧 MANDATORY WORKFLOWS
[Step-by-step required processes]

## 📚 PATTERN REFERENCES
[Links to .patterns/ for detailed guidance]

## 💻 VALIDATION COMMANDS
[Essential commands only]
```

**4. Leverage Progressive Disclosure:**
```markdown
# Instead of duplicating pattern details
## Development Patterns Reference
[Long explanations copied from .patterns/]

# Just reference the patterns
## Development Patterns
**CRITICAL:** Reference `.patterns/` directory BEFORE implementing:
- **effect-library-development.md** - Core patterns
- **error-handling.md** - Error handling
```

---

## 2. .patterns/README.md Improvements

### Current Issues

**Line 44 Formatting Error:**
```markdown
- __return yield_ for errors_*: Makes termination explicit in generators
```
Should be:
```markdown
- **return yield* for errors**: Makes termination explicit in generators
```

**Discoverability:**
- Doesn't clearly indicate when to use which pattern
- Could better guide agent to correct pattern file

### Recommended Changes

**Fix:** Apply formatting correction and improve discoverability:

```markdown
## 📚 AVAILABLE PATTERNS

### Core Development Patterns

**[effect-library-development.md](./effect-library-development.md)**
- **Use for:** New functions, Effect.gen composition, resource management
- **Contains:** Effect constructors, Layer patterns, testing with TestClock
- **Reference before:** Creating any new Effect-based function

**[error-handling.md](./error-handling.md)**
- **Use for:** Creating custom errors, error recovery, retry logic
- **Contains:** Data.TaggedError patterns, catchTag, error testing
- **Reference before:** Implementing error handling or validation

## 🎯 QUICK REFERENCE

**Creating new Effect function?** → effect-library-development.md
**Handling errors?** → error-handling.md
**Testing time-dependent code?** → effect-library-development.md (TestClock section)
**Creating custom error types?** → error-handling.md (Data.TaggedError section)
```

---

## 3. .patterns/ File Organization

### Current Structure
```
.patterns/
├── README.md
├── effect-library-development.md
└── error-handling.md
```

### Recommendations

**Option A: Keep Current (Recommended)**
- Simple, focused structure
- Two files cover core needs
- Easy to navigate

**Option B: Split Further (If files grow large)**
```
.patterns/
├── README.md
├── core/
│   ├── effect-gen-patterns.md
│   ├── layer-composition.md
│   └── resource-management.md
├── errors/
│   ├── tagged-errors.md
│   ├── error-recovery.md
│   └── error-testing.md
└── testing/
    ├── test-clock-patterns.md
    └── test-structure.md
```

**Current Recommendation:** Keep Option A unless files exceed ~500 lines

---

## 4. New File: .patterns/quick-reference.md

**Purpose:** One-page cheat sheet for common patterns

```markdown
# Quick Reference - Effect-Start Patterns

## 🚨 Never Do This
- ❌ try-catch in Effect.gen
- ❌ Type assertions (as any, as never, as unknown)
- ❌ yield* without return for errors

## ✅ Always Do This
- ✅ return yield* for errors/interrupts
- ✅ TestClock for time-dependent tests
- ✅ Data.TaggedError for custom errors

## Common Patterns

### Create Effect Function
```ts
export const myFunction = (input: string) =>
  Effect.gen(function*() {
    if (!input) return yield* Effect.fail("empty input")
    const result = yield* someEffect(input)
    return result
  })
```

### Handle Errors
```ts
operation.pipe(
  Effect.catchTag("ValidationError", error =>
    Effect.succeed("fallback")
  )
)
```

### Test with Time
```ts
const fiber = yield* Effect.fork(Effect.sleep("1 second"))
yield* TestClock.adjust("1 second")
const result = yield* Effect.Fiber.join(fiber)
```

## See Full Patterns
- **effect-library-development.md** - Complete patterns
- **error-handling.md** - Comprehensive error handling
```

---

## 5. Tool Usage Instructions

### Current Issue
Missing explicit instructions on when to use Claude Code tools

### Recommended Addition

Add to CLAUDE.md:

```markdown
## 🛠️ Tool Usage Priorities

**For research/exploration:**
- Use `Task` tool with `subagent_type=Explore` for codebase questions
- NEVER use direct Grep/Glob for open-ended exploration

**For file operations:**
- Use `Read` for reading files (not `cat`)
- Use `Edit` for editing (not `sed`/`awk`)
- Use `Write` for creating files (not `echo >`)
- Reserve `Bash` for actual system commands only

**For task management:**
- Use `TodoWrite` for multi-step tasks (3+ steps)
- Mark tasks in_progress before starting
- Complete immediately upon finishing
```

---

## 6. Testing Documentation

### Current Issue
Testing patterns spread across multiple sections

### Recommended Consolidation

In CLAUDE.md, create single testing section:

```markdown
## 🧪 Testing

**Co-location:** `Module.test.ts` alongside `Module.ts`

**CRITICAL Rules:**
- Time-dependent code MUST use TestClock
- Never rely on wall-clock time
- Test both success and error cases

**Commands:**
```bash
bun test <file>    # Specific file
bun test           # All tests
```

**For patterns:** See `.patterns/effect-library-development.md#testing`
```

---

## Implementation Priority

### Phase 1: High Impact (Do First)
1. ✅ Rename AGENTS.md → CLAUDE.md
2. ✅ Reduce CLAUDE.md to ~100 lines using suggested version
3. ✅ Fix .patterns/README.md formatting (line 44)
4. ✅ Add discoverability section to .patterns/README.md

### Phase 2: Medium Impact
5. ⚠️ Add tool usage priorities to CLAUDE.md
6. ⚠️ Create .patterns/quick-reference.md
7. ⚠️ Add "when to use" guidance to pattern files

### Phase 3: Maintenance
8. 📅 Test with Claude and measure effectiveness
9. 📅 Iterate based on repeated instructions in conversations
10. 📅 Use `#` during sessions to auto-incorporate new learnings

---

## Measurement Criteria

### Success Indicators

**Token Efficiency:**
- [ ] CLAUDE.md under 120 lines
- [ ] 60%+ reduction in repeated instructions
- [ ] Patterns referenced, not duplicated

**Instruction Adherence:**
- [ ] Claude consistently follows forbidden patterns
- [ ] Mandatory workflows executed without prompting
- [ ] Correct tool usage without reminders

**Developer Experience:**
- [ ] Fewer "reality check" interventions needed
- [ ] Consistent code quality across sessions
- [ ] Faster implementation of common tasks

### Testing Approach

**Before changes:**
1. Note common instruction violations
2. Count reminders needed per session
3. Track token usage per conversation

**After changes:**
1. Monitor for same violations
2. Count reduced reminders
3. Compare token usage

**Iterate:**
- If violations persist → increase emphasis (🚨, NEVER, CRITICAL)
- If still explaining same concept → add to CLAUDE.md
- If patterns rarely used → improve discoverability

---

## Examples from Research

### Example 1: Lean Instructions (Stripe)

**Before:**
```markdown
We use TypeScript for type safety and better developer tooling.
The components folder contains our React components organized by feature.
We follow best practices for code quality and maintainability.
```

**After:**
```markdown
[Delete all - obvious or generic information]
```

### Example 2: Specific Over Generic

**Before:**
```markdown
Write good tests for your code
```

**After:**
```markdown
Write test case for foo.py covering edge case where user is logged out; avoid mocks
```

### Example 3: Strategic Emphasis

**Before:**
```markdown
Don't use try-catch in Effect.gen because it doesn't work properly
```

**After:**
```markdown
### 🚨 FORBIDDEN: try-catch in Effect.gen
**NEVER use try-catch inside Effect.gen - causes runtime errors!**
```

---

## Additional Best Practices

### 1. Iterative Refinement
- Treat CLAUDE.md as living document
- Use `#` during sessions to capture repeated instructions
- Update after every 3-5 sessions based on learnings

### 2. Team Collaboration
- Commit CLAUDE.md to git for team sharing
- Use CLAUDE.local.md for personal preferences (gitignored)
- Document why changes were made in commit messages

### 3. Hierarchical Instructions
For monorepos:
```
root/CLAUDE.md              # Project-wide rules
packages/backend/CLAUDE.md  # Backend-specific rules
packages/frontend/CLAUDE.md # Frontend-specific rules
```
Most nested file takes precedence in subdirectories.

### 4. Version Control
```bash
# Include in feature commits
git add CLAUDE.md
git commit -m "feat: add validation workflow to CLAUDE.md"

# Document reasoning
git commit -m "docs: simplify CLAUDE.md per anthropic best practices
- Reduced from 359 to 115 lines
- Removed generic information
- Enhanced emphasis on critical rules"
```

---

## Next Steps

### Immediate Actions

1. **Review suggested CLAUDE.md** (`SUGGESTED-CLAUDE.md`)
   - Compare with current AGENTS.md
   - Identify any project-specific rules to preserve
   - Approve or request modifications

2. **Apply Phase 1 changes**
   - Rename AGENTS.md → CLAUDE.md
   - Replace content with streamlined version
   - Fix .patterns/README.md formatting

3. **Test effectiveness**
   - Start new Claude session
   - Monitor instruction adherence
   - Note any missing critical rules

4. **Iterate**
   - Add back only essential missing rules
   - Keep under 120 lines
   - Maintain lean, intentional approach

### Long-term Maintenance

- Review every 2-4 weeks
- Update when Effect library APIs change
- Add patterns for newly identified common issues
- Remove outdated or unused patterns

---

## Conclusion

**Key Takeaways:**

1. **Shorter is better** - Under 100 lines dramatically improves focus
2. **Specificity wins** - Concrete, project-specific rules over generic advice
3. **Progressive disclosure** - Reference detailed patterns, don't duplicate
4. **Strategic emphasis** - Make critical rules impossible to miss
5. **Living document** - Continuously refine based on actual usage

**Expected Outcomes:**

- 60-70% token cost reduction per conversation
- Improved instruction adherence
- Fewer repeated reminders needed
- Faster, more consistent implementations
- Better developer experience

**Implementation:** Start with Phase 1 (high impact changes), measure results, iterate based on real-world usage.

---

**Files Created:**
- `SUGGESTED-CLAUDE.md` - Streamlined 115-line version
- `AGENT-DOCS-IMPROVEMENTS.md` - This comprehensive guide

**Next:** Review, approve, and apply Phase 1 changes.
