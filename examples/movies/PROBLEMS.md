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

## HttpServerResponse with Cookies - CURRENT BLOCKER

**Issue**: Creating `HttpServerResponse.redirect()` with cookies causes runtime error:
```
TypeError: undefined is not an object (evaluating 'self.cookies')
  at isEmpty (/node_modules/@effect/platform/dist/esm/Cookies.js:239:53)
  at makeResponse (/@effect/platform-bun/dist/esm/internal/httpServer.js:97:16)
```

**Code Pattern Attempted**:
```typescript
const cookie = Cookies.unsafeMakeCookie(USER_SESSION, sessionId, {
  path: "/",
  httpOnly: true,
  maxAge: "30 days",
})

return HttpServerResponse.redirect("/", {
  status: 302,
  cookies: Cookies.setCookie(Cookies.empty, cookie),
})
```

**Investigation Needed**:
- Verify if `HttpServerResponse.redirect/empty` with cookies option is fully supported in current version
- Check if Route.html() wrapper is compatible with HttpServerResponse returns
- May need alternative approach for setting cookies on redirects

**Current Status**:
✅ POST /register - Receives data, validates email uniqueness
✅ POST /login - Receives data, validates credentials
❌ POST /register - Crashes when trying to set session cookie on redirect
❌ POST /login - Crashes when trying to set session cookie on redirect
✅ GET /register, /login, /logout - All form displays work
✅ / - Home page works
✅ /movies, /shows, /people - All data routes work
