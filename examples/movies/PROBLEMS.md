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

**Status**: Known limitation - these features do not work yet in effect-start framework. Using alternative patterns for authentication middleware.
