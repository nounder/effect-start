This instructs AI agents how to navigate and edit this codebase.

# Environment

Use Bun.js runtime.

dprint is used as a formatter:

```sh
# format all files
dprint fmt

# format a single file
dprint fmt $FILE
```

# Code

Use namespace imports instead of barrel ones:

```ts
import * as HttpServerRequest from "@effect/platform/HttpServerRequest"
import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"
```

When importing builtin node modules, always import full module and alias it as such:

```ts
import * as NPath from "node:path"
import * as NUrl from "node:url"
// etc.
```

ALWAYS use extension in file imports, even when it's `.ts`

```ts
import Server from "./server.ts"
```

Do not unwrap effects in `Effect.gen`. You can `yield*` effects directly.

Do not write obvious comments that restate what the code is doing without adding meaningful context.

Always run test after making all the changes.

When imported file name is capitalized, import it as namespace:

```ts
import * as Server from "./Server.ts"`
```

# Tests

Run test by running

```sh
bun test
```

Test single file:

```sh
bun test $FILE
```

Import test functions from `bun:test` module.

```ts
import {
  expect,
  it,
  test,
} from "bun:test"
```

Object passed to `expect()` and its methods MUST have new line for each property.
Put empty lines before and after `expect()` calls.
`expect()` methods must be in new line.

```ts
expect(isSuccess)
  .toBe(true)

expect(
  await pull({
    host: "localhost",
  }),
)
  .toMatchObject({
    data: [],
  })
```

```
```

```
```
