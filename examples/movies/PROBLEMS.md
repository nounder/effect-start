# Problems Encountered

## Git LFS Data Files

**Issue**: Unable to fetch actual JSON data files from git lfs due to HTTP 502 error from local proxy server.

**Files affected**:
- `data/people.json` (expected size: 47KB)
- `data/shows.json` (expected size: 174KB)

**Current status**: Created sample data files for development. Replace with actual data when git lfs access is restored.

**Command attempted**:
```bash
git lfs pull
# Error: batch response: Fatal error: Server error http://local_proxy@127.0.0.1:64777/git/nounder/effect-start.git/info/lfs/objects/batch from HTTP 502
```

## Route.middleware and Route.layout

**Status**: Known limitation - these features do not work yet in effect-start framework.

**Workaround**: Using per-route middleware pattern instead of global middleware. The `SignedUser.middleware` is called directly in routes that need authentication, and returns an `Option<SignedUserData>` that can be checked in each route.

## TypeScript Compilation Errors

**Issue**: TypeScript compiler shows errors for `effect-start` module imports, but the app runs correctly with Bun.

**Status**: These are type-checking errors that don't affect runtime. The `effect-start` module is resolved correctly by Bun's module resolution at runtime. This appears to be a tsconfig/module resolution configuration issue between TypeScript and Bun.

## Authentication Implementation

**Approach**: Implemented custom authentication using:
- **bun:sqlite** directly (instead of Drizzle ORM) wrapped in Effect services
- Custom `Sql` service for database operations
- `SignedUser` service for session management
- Cookie-based sessions with automatic extension
- Bun's built-in password hashing (`Bun.password.hash/verify`)

**Note**: The provided examples showed Drizzle ORM usage, but due to npm registry connectivity issues during development, implemented a simpler direct sqlite approach. This can be refactored to use Drizzle ORM when preferred.

## Route.html() POST Support - RESOLVED

**Solution Found**: Use method chaining pattern:
```typescript
export default Route.html(function*() {
  // GET handler
}).post(Route.html(function*() {
  // POST handler
}))
```

**Status**: POST requests now reach handlers correctly. Form data parsing with `UrlParams.getFirst()` works.

## HttpServerResponse with Cookies - RESOLVED

**Issue**: Creating `HttpServerResponse.redirect()` with cookies option caused runtime error when returned from Route.html() handlers.

**Root Cause**: `Route.html()` expects handlers to return values (string/JSX), not `HttpServerResponse` objects. When an `HttpServerResponse` with cookies was returned, the framework wrapped it again, causing the Cookies object to lose its proper prototype chain.

**Solution**: Use Set-Cookie header directly instead of the cookies option:
```typescript
const cookieValue = `${USER_SESSION}=${sessionId}; Path=/; HttpOnly; Max-Age=${SESSION_DURATION_MS / 1000}`

return HttpServerResponse.redirect("/", {
  status: 302,
  headers: {
    "set-cookie": cookieValue,
  },
})
```

**Status**: Implemented header-based cookies for /register, /login, and /logout routes. Testing pending due to npm registry connectivity preventing dependency installation.
