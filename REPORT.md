# dprint Binary Distribution & Cloud Code Hooks Investigation Report

## Executive Summary

This report documents the investigation into how the dprint npm package distributes and installs native binaries, and how it integrates with Cloud Code hooks for automatic code formatting.

## Key Findings

### 1. dprint Uses Platform-Specific Optional Dependencies

The main `dprint` npm package (14KB) does not contain the actual binary. Instead, it uses npm's optional dependencies feature to download platform-specific packages:

```json
{
  "name": "dprint",
  "version": "0.50.2",
  "optionalDependencies": {
    "@dprint/win32-x64": "0.50.2",
    "@dprint/win32-arm64": "0.50.2",
    "@dprint/darwin-x64": "0.50.2",
    "@dprint/darwin-arm64": "0.50.2",
    "@dprint/linux-x64-glibc": "0.50.2",
    "@dprint/linux-x64-musl": "0.50.2",
    "@dprint/linux-arm64-glibc": "0.50.2",
    "@dprint/linux-arm64-musl": "0.50.2",
    "@dprint/linux-riscv64-glibc": "0.50.2"
  }
}
```

### 2. Platform Detection Using package.json Constraints

Each platform-specific package declares its constraints:

```json
{
  "name": "@dprint/linux-x64-glibc",
  "version": "0.50.2",
  "os": ["linux"],
  "cpu": ["x64"],
  "libc": ["glibc"]
}
```

npm/bun automatically installs **only the matching package** for your platform during `npm install` or `bun add`.

### 3. Binary Size & Distribution

- **Main package**: ~14KB (wrapper JavaScript only)
- **Platform packages**: ~24.5MB each (contains the actual Rust binary)
- **Total installed**: ~14KB + ~24.5MB = ~24.5MB (only one platform package)

**Verification on this system:**
```bash
$ du -sh node_modules/dprint/
14K     node_modules/dprint/

$ du -sh node_modules/@dprint/linux-x64-glibc/
24M     node_modules/@dprint/linux-x64-glibc/
```

### 4. The postinstall Hook Mechanism

When you run `bun add -d dprint`, the following happens:

1. **Installation Phase**: Bun downloads:
   - `dprint` (14KB) - wrapper package
   - `@dprint/linux-x64-glibc` (24.5MB) - platform binary

2. **Postinstall Phase** (`install.js` runs):
   ```javascript
   // Detect platform
   const target = getTarget() // → "linux-x64-glibc"

   // Find the platform-specific binary
   const sourceExecutablePath = require.resolve("@dprint/linux-x64-glibc")
   // → /home/user/effect-start/node_modules/@dprint/linux-x64-glibc/dprint

   // Hard-link (or copy) to main package
   hardLinkOrCopy(sourceExecutablePath, targetExecutablePath)
   // → /home/user/effect-start/node_modules/dprint/dprint

   // Make executable
   chmodX(targetExecutablePath)
   ```

3. **Result**:
   - Both paths point to the **same file** (hard link shares inode)
   - `bunx dprint` resolves to `node_modules/dprint/dprint`
   - No runtime downloads needed

**Verification:**
```bash
$ ls -li node_modules/dprint/dprint node_modules/@dprint/linux-x64-glibc/dprint
2652 node_modules/@dprint/linux-x64-glibc/dprint
2652 node_modules/dprint/dprint
```
*(Same inode 2652 = hard link, not a copy)*

### 5. Why Hard-Link Instead of Copy?

```javascript
function hardLinkOrCopy(sourcePath, destinationPath) {
  try {
    fs.linkSync(sourcePath, destinationPath)  // Try hard link first
  } catch {
    atomicCopyFile(sourcePath, destinationPath)  // Fallback to copy
  }
}
```

**Benefits:**
- **Disk space**: No duplication (24MB saved)
- **Performance**: Instant (no file copying)
- **Convenience**: Makes `bunx dprint` work without resolving platform packages

### 6. Cloud Code Hooks Integration

The setup uses a PostToolUse hook that automatically formats files after Edit/Write operations.

**Hook Configuration** (`.claude/settings.json`):
```json
{
  "hooks": {
    "PostToolUse": [
      {
        "match": "Edit|Write",
        "type": "command",
        "command": "/home/user/effect-start/.claude/format-hook.sh"
      }
    ]
  }
}
```

**Hook Script** (`.claude/format-hook.sh`):
- Receives JSON via stdin with file path information
- Extracts file path using `jq`
- Checks if file extension matches supported types
- Runs `bunx dprint fmt "$file_path"` to format the file
- Always exits 0 to not block operations

**Supported file types:**
- TypeScript: `.ts`, `.tsx`
- JavaScript: `.js`, `.jsx`
- Markup: `.json`, `.md`, `.mdx`, `.html`, `.css`

## Verification Tests

### Test 1: Binary Availability
```bash
$ bunx dprint --version
dprint 0.50.2  ✓
```

### Test 2: Manual Hook Execution
```bash
$ echo '{"tool_input":{"file_path":"/path/to/test.ts"}}' | .claude/format-hook.sh
Formatted 1 file.  ✓
```

### Test 3: Formatting Behavior
**Input:**
```typescript
const   badly={formatted:1,code:2};function    test(  ){return badly;}
```

**After dprint:**
```typescript
const badly = { formatted: 1, code: 2 }
function test() {
  return badly
}
```

## Common Pattern in Native Node Packages

This distribution strategy is used by many native tooling packages:

- **esbuild**: `esbuild` + `@esbuild/linux-x64`, etc.
- **swc**: `@swc/core` + `@swc/core-linux-x64-gnu`, etc.
- **sharp**: `sharp` + `@img/sharp-linux-x64`, etc.
- **dprint**: `dprint` + `@dprint/linux-x64-glibc`, etc.

**Why this pattern?**
1. **Cross-platform support**: One `npm install` command works everywhere
2. **Minimal downloads**: Only download what you need
3. **Offline support**: Binary is local after install
4. **Performance**: Native binaries are fast

## Conclusion

The dprint npm package **does include the binary** through its platform-specific optional dependencies. The binary is:

- ✓ Downloaded during `bun add -d dprint` (not at runtime)
- ✓ Available locally in `node_modules` after installation
- ✓ Works offline after initial install
- ✓ Perfect for Cloud Code hooks integration

The Cloud Code hooks setup will work reliably because the dprint binary is guaranteed to be present in the `node_modules` directory after package installation.

## References

- npm package: https://www.npmjs.com/package/dprint
- Platform package: https://www.npmjs.com/package/@dprint/linux-x64-glibc
- GitHub repo: https://github.com/dprint/dprint
- Cloud Code hooks docs: https://code.claude.com/docs/en/hooks.md
