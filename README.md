# Effect Start

Build declarative full-stack apps with Effect.

This project is in its early stage. However, the code is well documented so you should be able to figure out how to use it
by checking out `examples/` directory.

## Prerequisites

Effect Start uses [Bun](https://bun.sh) as its runtime, bundler, and test runner.

Install dependencies:

```sh
bun install
```

## Running Tests

All tests live alongside source files in `src/` and use the `bun:test` module.

```sh
# run all tests
bun test

# run a specific test file
bun test RouteHttp.test.ts

# run tests matching a pattern
bun test FileRouter
```

The test root is configured in `bunfig.toml` to point at `./src`, so
`bun test` picks up every `*.test.ts` and `*.test.tsx` file under `src/`
automatically.

Type-level tests use `expectTypeOf` from `bun:test`:

```ts
import * as test from "bun:test"

test
  .expectTypeOf(value)
  .toMatchObjectType<{ method: "GET" }>()
```

## Formatting

Code is formatted with [dprint](https://dprint.dev):

```sh
bun run format
```

## Building

```sh
bun run build
```

This runs the TypeScript compiler against `tsconfig.build.json`, which
outputs declarations and JS to `dist/`.

## Repository Structure

```
effect-start/
├── src/                          # All source code and tests
│   ├── index.ts                  # Main package entry point
│   ├── Start.ts                  # Server entry / Start.serve + Start.layer
│   │
│   ├── Route.ts                  # Route definition primitives
│   ├── RouteHttp.ts              # HTTP request/response handling
│   ├── RouteSse.ts               # Server-Sent Events routes
│   ├── RouteHook.ts              # Route lifecycle hooks
│   ├── RouteBody.ts              # Request body parsing
│   ├── RouteSchema.ts            # Schema-based request validation
│   ├── RouteMount.ts             # Mounting sub-routes
│   ├── RouteTree.ts              # Route tree data structure
│   ├── RouteTrie.ts              # Trie-based route matching
│   ├── RouteHttpTracer.ts        # HTTP tracing / debugging
│   │
│   ├── FileRouter.ts             # File-based routing system
│   ├── FileRouterCodegen.ts      # Code generation for file routes
│   ├── FilePathPattern.ts        # File path → route pattern mapping
│   ├── PathPattern.ts            # URL path pattern matching
│   ├── TuplePathPattern.ts       # Tuple-based path patterns
│   │
│   ├── Http.ts                   # HTTP utilities
│   ├── Socket.ts                 # WebSocket support
│   ├── Cookies.ts                # Cookie handling
│   ├── ContentNegotiation.ts     # Content negotiation (Accept headers)
│   │
│   ├── Entity.ts                 # Entity base classes
│   ├── Values.ts                 # Value utilities
│   ├── Unique.ts                 # Unique ID generation
│   ├── SchemaExtra.ts            # Schema extensions
│   ├── StreamExtra.ts            # Stream extensions
│   ├── Effectify.ts              # Effect utility helpers
│   ├── Commander.ts              # CLI command utilities
│   ├── Development.ts            # Development mode utilities
│   ├── PlatformError.ts          # Platform error handling
│   ├── PlatformRuntime.ts        # Platform runtime abstraction
│   │
│   ├── bun/                      # Bun runtime integration
│   │   ├── BunServer.ts          # Bun HTTP server implementation
│   │   ├── BunRoute.ts           # Bun route handler
│   │   ├── BunBundle.ts          # Bundle management
│   │   ├── BunRuntime.ts         # Bun runtime utilities
│   │   └── ...                   # Bun-specific plugins and tests
│   │
│   ├── bundler/                  # Bundling abstractions
│   │   ├── Bundle.ts
│   │   └── BundleFiles.ts
│   │
│   ├── client/                   # Client-side code
│   │   ├── Overlay.ts            # Development overlay component
│   │   └── ScrollState.ts        # Scroll state tracking
│   │
│   ├── hyper/                    # JSX / HTML rendering engine
│   │   ├── Hyper.ts              # Hyper HTML generator
│   │   ├── HyperHtml.ts          # HTML serialization
│   │   ├── HyperNode.ts          # Virtual node representation
│   │   ├── HyperRoute.ts         # Route handler integration
│   │   ├── jsx-runtime.ts        # JSX transform target
│   │   └── jsx.d.ts              # JSX type definitions
│   │
│   ├── datastar/                 # Datastar reactive framework (server-side)
│   │   ├── engine.ts             # Core reactive engine
│   │   ├── actions/              # Fetch, peek, setAll, toggleAll
│   │   ├── attributes/           # Reactive attribute bindings
│   │   └── watchers/             # DOM and signal patchers
│   │
│   ├── node/                     # Node.js compatibility layer
│   │   ├── NodeFileSystem.ts
│   │   └── NodeUtils.ts
│   │
│   ├── testing/                  # Test utilities
│   │   ├── TestLogger.ts         # Test logger service
│   │   └── utils.ts              # Test helpers
│   │
│   ├── experimental/             # Experimental features
│   │   └── EncryptedCookies.ts
│   │
│   └── x/                        # Extensions
│       ├── cloudflare/           # Cloudflare tunnel integration
│       ├── datastar/             # Datastar JSX bindings
│       └── tailwind/             # Tailwind CSS plugin
│
├── examples/                     # Example applications
│   └── bun-chat-tailwind/        # Chat app with Tailwind CSS
│
├── scripts/                      # Utility scripts
│   ├── format                    # Code formatting
│   └── package-version           # Version management
│
├── static/                       # Static HTML test pages
│
├── .patterns/                    # Development pattern documentation
│   ├── EffectLibraryDevelopment.md
│   ├── ErrorHandling.md
│   └── QuickReference.md
│
├── package.json                  # Bun scripts, exports, peer deps
├── tsconfig.json                 # TypeScript config (strict, ESNext, JSX)
├── tsconfig.build.json           # Build config (emits to dist/)
├── dprint.json                   # Formatter config
├── bunfig.toml                   # Bun config (test root: ./src)
└── AGENTS.md                     # Import conventions & coding guidelines
```

## Development

### Configuration

`server.ts` is a main entrypoint for all environments. No more divergence between dev and prod!

It exports a layer that applies configuration and changes the behavior of the server:

```typescript
import {
  FileRouter,
  Start,
} from "effect-start"

export default Start.layer(
  FileRouter.layer({
    load: () => import("./routes/routes.gen.ts"),
    path: import.meta.resolve("./routes/routes.gen.ts"),
  }),
)

if (import.meta.main) {
  Start.serve(() => import("./server.ts"))
}
```

### File-based Routing

Effect Start provides automatic file-based routing with support for frontend pages, backend endpoints, and stackable middlewares called Route Layers.

```
$ tree src/routes
src/routes
├── [[...frontend]]
│   └── route.ts
├── admin
│   ├── data.json
│   │   └── route.tsx
│   ├── layer.tsx
│   └── route.tsx
├── layer.tsx
├── routes.gen.ts
└── route.tsx
```

### Tailwind CSS Support

Effect Start comes with Tailwind plugin that is lightweight and
works with minimal configuration.

First, install official Tailwind package:

```sh
bun add -D tailwindcss
```

Then, register a plugin in `bunfig.toml`:

```toml
[serve.static]
plugins = ["effect-start/x/tailwind/plugin"]
```

Finally, include it in your `src/app.css`:

```html
@import "tailwindcss";
```
