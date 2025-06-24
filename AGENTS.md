This instructs AI agents how to navigate and edit this codebase.

# Environment

- We use Bun.js runtime.
- dprint is used as a formatter.
  - Run `dprint fmt` to format all files.
    - Format a single file: `dprint fmt $FILE`.

# Code

- Alis Effect Schema as `S` like so: `import { Schema as S } from "effect"`.
- When importing builtin node modules, always import full module and alias it as such:
  NPath for node:path, NUrl for node:url, etc.
- ALWAYS use extension in file imports.
- Do not unwrap effects in `Effect.gen`. You can `yield*` effects directly.
- Do not write obvious comments that restate what the code is doing without adding meaningful context.
- Always run test after making all the changes.

# Tests

- Run test by running `bun test`.
  - Test single file: `bun test $FILE`.
- Import test functions from `bun:test` module.
- Object passed to expect() and its methods MUST have new line for each property.
