# Problems Encountered

## 1. Git LFS Data Access

**Problem**: The JSON data files in `examples/movies/data/` are stored in Git LFS, but the LFS server returned HTTP 502 errors when attempting to pull the data.

**Attempted Solutions**:
- Installed git-lfs from the official release (v3.7.1)
- Attempted `git lfs pull` command

**Error**:
```
batch response: Fatal error: Server error http://local_proxy@127.0.0.1:18421/git/nounder/effect-start.git/info/lfs/objects/batch from HTTP 502
```

**Workaround**: Created sample JSON data files manually with realistic movie, TV show, and people data for demonstration purposes.

## 2. Route.{middleware, layout} Not Working

**Status**: As noted in the task description, `Route.middleware` and `Route.layout` are not currently working in effect-start. These features were avoided in the implementation.

**Impact**:
- Could not use route-level middleware for authentication
- Layout implementation had to be handled differently

## 3. import.meta.dir Not Available

**Problem**: Attempted to use `import.meta.dir` to resolve data directory path, but this property is not available in the current environment.

**Solution**: Used hardcoded relative path `./examples/movies/data` instead.

**File**: `src/Data.ts`

## 4. Package Installation Issues

**Problem**: When trying to install `drizzle-orm` via `bun add`, encountered hanging installations and cache errors:

```
ENOENT: failed copying files from cache to destination for package effect-start
```

**Solution**:
1. Manually added `drizzle-orm` to `package.json`
2. Removed `bun.lock`
3. Ran fresh `bun install`

The drizzle-orm package was successfully installed despite the hanging process.

## 5. Type System Complexities

**Areas requiring attention**:
- Route parameter typing may need refinement
- Form schema validation integration with Route.schemaPost
- Proper typing of database queries with Drizzle

## 6. Missing Features for Production

**Authentication**:
- No password strength validation
- No email verification flow
- No password reset functionality
- No CSRF protection
- Sessions are cookie-based only (no Redis/memory store)

**Database**:
- No migrations setup
- Tables created via raw SQL in service initialization
- No database seeding

**Error Handling**:
- Basic error handling only
- No user-friendly error pages
- Authentication errors may need better UX

## 7. Development Server Startup Issues

**Problem**: Unable to start the development server due to dependency resolution issues.

**Errors encountered**:
1. `Cannot find package 'effect-start'` - Symlink to parent directory not properly resolved
2. `ENOENT while resolving package '@effect/platform/HttpMiddleware'` - effect-start dependencies not available
3. Hanging `bun install` commands in root directory during dependency resolution

**Attempted Solutions**:
1. Fixed symlink with `ln -s /home/user/effect-start node_modules/effect-start`
2. Attempted to install dependencies in root effect-start directory
3. Process hung indefinitely on "Resolving dependencies"

**Status**: Development server could not be started for testing. Implementation is code-complete but untested at runtime.

**Next Steps for Testing**:
- Resolve dependency installation issues
- Complete installation of effect-start dev dependencies
- Start dev server and test authentication flow with curl

## Notes

- The implementation uses Bun's built-in password hashing (`Bun.password.hash` and `Bun.password.verify`)
- Session duration is hardcoded to 30 days
- Database file is stored at `./examples/movies/data/movies.db`
- All code follows Effect best practices (no try-catch in Effect.gen, proper use of Effect.promise for async operations, return yield* pattern for errors)
