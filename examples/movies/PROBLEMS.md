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

**Specific Issue**: TypeScript complains about `for` attribute on `<label>` elements, expecting React's `htmlFor` instead. However, effect-start uses HyperHTML which follows standard HTML attributes (defined in `/home/user/effect-start/src/jsx.d.ts:1606` as `for?: string`). The code is correct; TypeScript is using React's type definitions as a fallback when effect-start's types aren't available due to missing node_modules.

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

## Route.html() Cookie-Based Authentication - LIMITATION

**Issue**: `Route.html()` handlers cannot set HTTP cookies because they expect to return HTML/JSX content, not `HttpServerResponse` objects with cookies.

**Root Cause**: The Route API has two handler types:
- `RouteHandler.Value` (used by Route.html/json/text) - returns raw values that get wrapped in responses
- `RouteHandler.Encoded` - returns `HttpServerResponse` directly (not currently exposed in public API)

Route.html() wraps return values in HTML responses, so returning `HttpServerResponse.redirect()` with cookies causes type errors and runtime issues.

**Current Solution**: Authentication routes return HTML success pages instead of HTTP redirects:
- `/login` POST → Returns "Login Successful" page with link to home
- `/register` POST → Returns "Registration Successful" page
- `/logout` → Returns "Logged Out" page

**Limitation**: Session cookies are created in the database but not sent to the browser. The `SignedUser.middleware` cannot validate sessions without browser cookies being set.

**Future Enhancement Needed**: To properly implement cookie-based auth, effect-start would need:
1. A Route constructor that returns `RouteHandler.Encoded` for direct HttpServerResponse control, OR
2. Middleware support that can intercept responses and set cookies, OR
3. Server-level cookie management that works with session IDs returned from route handlers

**Current Auth Status**:
✅ Database schema and services implemented
✅ Password hashing and validation works
✅ Session creation in database works
❌ Cookies not set in browser (authentication non-functional)
✅ All route forms display correctly
