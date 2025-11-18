# Effect-Start Issues Found During Movies Demo Development

## 1. Route.layer and Route.layout Not Available

**Status**: Confirmed issue as mentioned by user

**Description**: The following Route methods are not available in the current effect-start implementation:
- `Route.layer()` - For route grouping and shared configuration
- `Route.layout()` - For layout components
- `Route.middleware()` - For middleware composition

**Impact**:
- Cannot use layout components as shown in existing example code
- Cannot create middleware layers for route groups
- Existing examples in `src/routes/(admin)/layer.ts` and `src/routes/layer.tsx` don't compile

**Workaround**:
- Use basic `Route.html()` and `Route.text()` without layout features
- Implement authentication and middleware logic directly in routes

## 2. Type Errors in Effect Module Imports

**Description**: Various Effect module imports fail in the effect-start codebase itself:
- `effect/Array`, `effect/Chunk`, `effect/Data`, etc. cannot be found
- This appears to be a version mismatch or build configuration issue

**Files Affected**:
- `src/bun/BunFullstackServer_httpServer.ts`
- `src/testing.ts`
- Various other core files

**Impact**:
- Type checking fails even for valid route code
- Cannot rely on `tsc --noEmit` for validation

**Workaround**:
- Test functionality at runtime using `bun run dev`
- Ignore type errors for development

## 3. Route Parameter Type Safety Issues

**Description**: When using `Effect.gen()` for data loading within routes, type inference breaks:

```typescript
const loadPersonById = (id: number) =>
  Effect.gen(function*() {
    const fs = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    // Type errors occur here
  })
```

**Error Message**: Arguments are not assignable due to Generator type incompatibility

**Impact**:
- Cannot use complex Effect composition within route handlers easily
- Type safety is compromised

## 4. Missing effect-start/middlewares Module

**Description**: Import `from 'effect-start/middlewares'` fails:
```typescript
import { BasicAuthMiddleware } from "effect-start/middlewares"
```

**Error**: `Cannot find module 'effect-start/middlewares'`

**Impact**:
- Cannot use built-in middleware like BasicAuth
- Admin routes example doesn't work

## Summary

The current effect-start framework is in active development and has several APIs that are partially implemented or missing. For the movies demo:

1. ✅ Basic routing with `Route.html()` and `Route.text()` works
2. ✅ URL parameter parsing with `Route.schemaUrlParams()` works
3. ❌ Layout and middleware features are not functional
4. ❌ Type checking is unreliable due to upstream issues
5. ❌ Complex Effect composition in routes has type issues

**Recommendation**: Focus on simple route implementations and test functionality at runtime rather than relying on compile-time type checking.
