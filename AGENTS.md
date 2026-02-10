# Environment

- Use Bun runtime.

# Code

Follow these import rules:

```ts
// when importing Node modules name them like such:
import * as NPath from "node:path`
// always import test module as namespace:
import * as test from "bun:test"
// import Effect sub-modules directly
import * as Schema from "effect/Schema"
// Always use extension in local module imports:
import type * as Files from "./Files.ts"
// When import module is lowercase, prefer named imports:
import { start } from "./server.ts"
```

Do not write obvious comments that restate what the code is doing
without adding meaningful context.

# Tests

Always run test when making final changes:

```sh
# run all tests
bun test

# run specific test
bun test routing.test.ts

# run type system tests
tsgo
```

Write tests:

```ts
// use test.expect when testing runtime
test.expect(routes).toEqual([
  {
    type: "Literal",
  },
])

// use test.expectTypeOf when testing types
test.expectTypeOf(context).toMatchObjectType<{
  method: "GET"
}>()
```

# Misc

Do NOT use section header comments (like `// -----------------------`)
