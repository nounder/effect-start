# Environment

- Use Bun runtime.

# Code

Follow these import rules:

```ts
// when importing Node modules name them like such:
import * as NPath from "node:path`
import * as NUrl from "node:url`

// always import test module as namespace:
import * as test from "bun:test"

// import Effect sub-modules directly
import * as Schema from "effect/Schema"

// Always use extension in local module imports:
import * as Files from "./Files.ts"

// When importing a module that is capitalized, always import it as namespace,
// like in examples above (except for `bun:test`)
// When import module is lowercase, prefer named imports:
import { start } from "./server.ts"
import { list } from "./games" // or index.ts

// also import types as namespace
import type * as Types from "effect/Types"
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
// import test module as namespace
import * as test from "bun:test"

// use test.expect when testing runtime
test.expect(routes).toEqual([
  {
    type: "Literal",
  },
  {
    type: "Param",
  },
])

// use test.expectTypeOf when testing types
test.expectTypeOf(context).toMatchObjectType<{
  method: "GET"
}>()

// put each generic and property in new line for readability
test.expectTypeOf<Items[3]>().toExtend<Route<{ method: "POST" }, [Format<Json>]>>()
```
