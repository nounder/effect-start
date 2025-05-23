This instructs AI agents how to navigate and edit this codebase.

# Environment

- We use Bun.js runtime
- dprint is used as a formatter
  - Run `dprint fmt` to format all files
    - Format a single file: `dprint fmt $FILE`

# Code

- When importing Effect Schema, always alias it as S, like so: `import { Schema as S } from "effect"`
- When importing node modules, always import the full module and name it NPath for node:path, NUrl for node:url, etc.
- Always use extension in file imports.
- Do not unwrap effects in `Effect.gen`. You can `yield*` effects directly.
- Do not write obvious comments that restate what the code is doing without adding meaningful context.

# Tests

- Run test by running `bun test`
  - Test single file: `bun test $FILE`
- Import test functions like so: `import { describe, expect, it, test } from "bun:test"`
