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

---

# Part 2: dprint Plugin Architecture Deep Dive

## Overview: WASM Plugin System

dprint uses WebAssembly (WASM) plugins as its primary plugin mechanism. This architecture provides portability, sandboxing, and language-agnostic plugin development while maintaining performance.

## Plugin Types

dprint supports two plugin architectures:

1. **WASM Plugins** (Preferred)
   - Compiled to `.wasm` files
   - Run sandboxed in a WASM runtime
   - Portable across all platforms
   - No direct file system access
   - Language-agnostic (any language that compiles to WASM)

2. **Process Plugins** (Legacy)
   - Compiled to executable files
   - Do NOT run sandboxed
   - Require checksums for security
   - Less portable
   - Used when WASM compilation isn't available

## Architecture Components

### 1. WASM Plugin (The Formatter Logic)

**Responsibilities:**
- Implement parsing logic for the target language
- Implement formatting/code transformation logic
- Maintain internal formatting state
- Provide configuration validation
- Communicate via shared memory buffer

**What plugins DO:**
- Parse source code into AST (Abstract Syntax Tree)
- Transform AST according to formatting rules
- Generate formatted output
- Validate and resolve configuration
- Request formatting from other plugins (for embedded languages)

**What plugins CANNOT do:**
- Read/write files directly (no file system access)
- Make network requests
- Access operating system APIs
- Perform any I/O operations

**Plugin Interface (Rust - `SyncPluginHandler` trait):**

```rust
trait SyncPluginHandler<Configuration> {
    // Returns plugin metadata (name, version, etc.)
    fn plugin_info(&mut self) -> PluginInfo;

    // Returns license text
    fn license_text(&mut self) -> String;

    // Resolves and validates configuration
    fn resolve_config(
        &mut self,
        config: ConfigKeyMap,
        global_config: &GlobalConfiguration,
    ) -> PluginResolveConfigurationResult<Configuration>;

    // Checks for configuration updates
    fn check_config_updates(
        &self,
        message: CheckConfigUpdatesMessage,
    ) -> Result<Vec<ConfigChange>>;

    // Performs the actual formatting
    fn format(
        &mut self,
        request: SyncFormatRequest<Configuration>,
        format_with_host: impl FnMut(SyncHostFormatRequest) -> FormatResult,
    ) -> FormatResult;
}
```

**Communication Model - Shared Memory Buffer:**

Plugins communicate with the host through a shared WASM linear memory buffer:

1. **Plugin → Host**: Plugin writes data to shared buffer, calls host import function
2. **Host reads buffer**: Host processes request, stores results in local array
3. **Host → Plugin**: Plugin reads from host's array via exported functions

**Required WASM Exports (Low-level interface):**

```
Memory management:
- get_shared_bytes_ptr() → Returns pointer to shared buffer
- clear_shared_bytes() → Clears buffer for reuse

Configuration:
- register_config() → Initialize configuration
- release_config() → Cleanup configuration
- get_config_diagnostics() → Return validation errors (JSON)
- get_resolved_config() → Return finalized config (JSON)

Formatting:
- set_file_path() → Set file path for formatting
- set_override_config() → Set override config
- format() → Format and return status (0=no change, 1=changed, 2=error)
- get_formatted_text() → Retrieve formatted output
- get_error_text() → Retrieve error message

Optional:
- format_range() → Format specific text range
- check_config_updates() → Check for config improvements
```

**Host-Provided WASM Imports:**

```
Formatting delegation:
- host_format() → Request host to format with another plugin
- host_get_formatted_text() → Get result from host formatting
- host_get_error_text() → Get error from host formatting

Status:
- host_has_cancelled() → Check if formatting should abort

Communication:
- host_write_buffer() → Signal host to read plugin data
```

### 2. Rust CLI (The Host - I/O & Orchestration)

**Responsibilities:**
- File system operations (reading, writing, discovering files)
- Plugin lifecycle management (download, cache, load, unload)
- WASM runtime initialization (using Wasmer)
- Configuration file parsing
- Coordinating multiple plugins
- Incremental formatting tracking
- Error handling and reporting

**Where I/O Happens:**

All I/O operations occur in the Rust CLI, NOT in plugins:

1. **File Discovery:**
   - Reads `dprint.json` configuration
   - Scans file system for files matching glob patterns
   - Respects exclude patterns
   - Tracks file modification times for incremental formatting

2. **Plugin Management:**
   - Downloads plugins from `https://plugins.dprint.dev/`
   - Caches in `~/.cache/dprint/` (Linux) or platform equivalent
   - Compiles and caches WASM modules
   - Verifies checksums

3. **File Reading/Writing:**
   - Reads source files from disk
   - Passes file content to plugins via WASM interface
   - Writes formatted output back to disk
   - Handles file permissions and errors

4. **Configuration:**
   - Reads `dprint.json` from file system
   - Parses JSON configuration
   - Distributes config to plugins

**CLI Workflow:**

```
1. Parse dprint.json configuration file
2. Download/load plugins from cache
3. Initialize WASM runtime (Wasmer)
4. Instantiate each plugin's WASM module
5. Discover files matching patterns
6. For each file:
   a. Read file content from disk
   b. Determine which plugin handles this file
   c. Call plugin's format() via WASM interface
   d. If changed, write back to disk
7. Report statistics
```

**Cache Directory Structure:**

```
~/.cache/dprint/
├── typescript-0.95.11.wasm          # Downloaded plugin
├── typescript-0.95.11.compiled_wasm  # Compiled WASM module
├── json-0.20.0.wasm
├── json-0.20.0.compiled_wasm
└── incremental/                      # Incremental formatting state
    └── <hash>/
        └── formatted_files.json
```

### 3. JavaScript Package (@dprint/formatter - Browser/Node.js Loader)

**Responsibilities:**
- Load and instantiate WASM plugins in JavaScript environments
- Provide JavaScript API for formatting operations
- Handle WASM module initialization
- Manage memory between JavaScript and WASM

**What @dprint/formatter DOES:**

- Provides `createStreaming(fetch())` to load plugins from URLs
- Provides `createFromBuffer()` to load plugins from npm packages
- Exposes simple API: `setConfig()`, `formatText()`
- Bridges JavaScript and WASM memory spaces
- Handles no I/O operations (caller provides file content)

**API Example:**

```javascript
import { createStreaming } from "@dprint/formatter";

// Load plugin from URL
const formatter = await createStreaming(
  fetch("https://plugins.dprint.dev/typescript-0.95.11.wasm")
);

// Configure
formatter.setConfig(
  { indentWidth: 2, lineWidth: 80 },  // Global config
  { semiColons: "asi" }                // Plugin config
);

// Format (caller provides content, no file I/O)
const formatted = formatter.formatText({
  filePath: "example.ts",  // Used for extension detection
  fileText: "const x={a:1};"
});

console.log(formatted); // "const x = { a: 1 }"
```

**Where I/O Happens in JS Context:**

The `@dprint/formatter` package does **NO I/O**. The calling application must:

- Fetch WASM plugins (via `fetch()` or filesystem)
- Read source files
- Write formatted output
- Manage configuration

This makes it suitable for:
- Browser-based formatters
- Editor extensions
- Custom build tools
- Deno/Node.js scripts

## Responsibility Summary

| Component | Parsing | Formatting | File I/O | Plugin Loading | WASM Runtime | Configuration |
|-----------|---------|------------|----------|----------------|--------------|---------------|
| **WASM Plugin** | ✅ Yes | ✅ Yes | ❌ No | ❌ No | ❌ No | ✅ Validates |
| **Rust CLI** | ❌ No | ❌ No | ✅ Yes | ✅ Yes | ✅ Yes (Wasmer) | ✅ Reads |
| **@dprint/formatter** | ❌ No | ❌ No | ❌ No* | ✅ Yes | ✅ Yes (Web) | ✅ Passes |

*@dprint/formatter leaves I/O to the caller

## I/O Boundary Analysis

```
┌─────────────────────────────────────────────────┐
│ File System (OS)                                │
│ - Source files (.ts, .js, .json, etc.)         │
│ - dprint.json configuration                     │
│ - Plugin cache (~/.cache/dprint/)               │
└─────────────────┬───────────────────────────────┘
                  │
                  │ Read/Write Operations
                  ↓
┌─────────────────────────────────────────────────┐
│ Rust CLI Host (dprint binary)                  │
│ ─────────────────────────────────────────────  │
│ - Discovers files (glob matching)              │
│ - Reads file content                           │
│ - Loads plugins from cache                     │
│ - Initializes Wasmer runtime                   │
│ - Writes formatted output                      │
│                                                 │
│  ┌───────────────────────────────────────────┐ │
│  │ Wasmer WASM Runtime (Sandbox)             │ │
│  │ ─────────────────────────────────────────  │ │
│  │  ┌─────────────────────────────────────┐  │ │
│  │  │ TypeScript Plugin (.wasm)           │  │ │
│  │  │ - Parses TypeScript                 │  │ │
│  │  │ - Formats code                      │  │ │
│  │  │ - NO file system access             │  │ │
│  │  └─────────────────────────────────────┘  │ │
│  │  ┌─────────────────────────────────────┐  │ │
│  │  │ JSON Plugin (.wasm)                 │  │ │
│  │  │ - Parses JSON                       │  │ │
│  │  │ - Formats JSON                      │  │ │
│  │  │ - NO file system access             │  │ │
│  │  └─────────────────────────────────────┘  │ │
│  │                                             │ │
│  │  Shared Memory Buffer ↔ Communication      │ │
│  └───────────────────────────────────────────┘ │
└─────────────────────────────────────────────────┘
```

## JavaScript Usage (Alternative Path)

```
┌─────────────────────────────────────────────────┐
│ Application Code (Node.js/Browser)             │
│ ─────────────────────────────────────────────  │
│ - Caller reads files                           │
│ - Caller provides file content                 │
│ - Caller writes formatted output               │
│                                                 │
│  ┌───────────────────────────────────────────┐ │
│  │ @dprint/formatter (JS Loader)             │ │
│  │ ─────────────────────────────────────────  │ │
│  │ - Loads WASM plugins                      │ │
│  │ - Initializes Web WASM runtime            │ │
│  │ - Provides formatText() API               │ │
│  │                                             │ │
│  │  ┌─────────────────────────────────────┐  │ │
│  │  │ TypeScript Plugin (.wasm)           │  │ │
│  │  │ - Same WASM file as CLI             │  │ │
│  │  │ - Parses and formats                │  │ │
│  │  │ - NO file system access             │  │ │
│  │  └─────────────────────────────────────┘  │ │
│  └───────────────────────────────────────────┘ │
└─────────────────────────────────────────────────┘
```

## Security & Sandboxing

**WASM Plugin Sandbox Benefits:**

1. **No File System Access**: Plugins cannot read or write files
2. **No Network Access**: Plugins cannot make HTTP requests
3. **Memory Isolation**: Each plugin has isolated linear memory
4. **Deterministic**: Same input always produces same output
5. **No Side Effects**: Cannot modify global state

**Wasmer Runtime Notes:**

- Early versions had filesystem sandbox issues
- Modern versions properly isolate WASM modules
- Plugins must explicitly request host operations via imports
- dprint uses a minimal set of host imports (no filesystem exposed)

## Plugin Development Flow

```rust
// 1. Define your configuration
#[derive(Serialize, Deserialize)]
struct Config {
    line_width: u32,
    indent_width: u32,
}

// 2. Implement SyncPluginHandler
struct MyFormatter;

impl SyncPluginHandler<Config> for MyFormatter {
    fn plugin_info(&mut self) -> PluginInfo {
        PluginInfo {
            name: "my-formatter".to_string(),
            version: "0.1.0".to_string(),
            config_key: "myFormatter".to_string(),
            file_extensions: vec!["myext".to_string()],
            help_url: "https://...".to_string(),
        }
    }

    fn format(
        &mut self,
        request: SyncFormatRequest<Config>,
        format_with_host: impl FnMut(SyncHostFormatRequest) -> FormatResult,
    ) -> FormatResult {
        let file_text = request.file_text;
        let config = request.config;

        // Parse and format the code
        let formatted = my_format_logic(file_text, config);

        FormatResult::Changed(formatted)
    }

    // ... other trait methods
}

// 3. Generate plugin code (creates all WASM exports)
dprint_core::generate_plugin_code!(MyFormatter, MyFormatter);
```

## Key Insights

1. **Clear Separation of Concerns:**
   - Plugins: Pure formatting logic (parsing + transformation)
   - Host: All I/O operations and orchestration
   - JS Loader: WASM initialization in web environments

2. **Portable Plugins:**
   - Same `.wasm` file works in CLI and JavaScript
   - No recompilation needed for different platforms
   - Plugins are language-agnostic

3. **Performance:**
   - WASM plugins are fast (near-native performance)
   - No process spawning overhead
   - Efficient shared memory communication

4. **Security:**
   - Sandboxed execution prevents malicious plugins
   - No direct system access
   - Predictable resource usage

## References

- npm package: https://www.npmjs.com/package/dprint
- Platform package: https://www.npmjs.com/package/@dprint/linux-x64-glibc
- GitHub repo: https://github.com/dprint/dprint
- WASM plugin docs: https://github.com/dprint/dprint/blob/main/docs/wasm-plugin-development.md
- @dprint/formatter: https://github.com/dprint/js-formatter
- dprint-core: https://docs.rs/dprint-core/
- Cloud Code hooks docs: https://code.claude.com/docs/en/hooks.md
