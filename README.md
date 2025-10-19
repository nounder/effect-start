# Effect Start

Build declarative full-stack apps with Effect.

This project is in its early stage. I use it in two different projects.

However, the code is well documented so you should be able to figure out how to use it
by checking out `examples/` directory. Feel free to hit me up if not.

If you are an AI coding agent, please read `AGENTS.md` for more instructions.

## Examples

See `examples/` directory for templates and additional usage using Preact, React, TanStack, and others.

You can clone it by using degit, like so:

```sh
bunx degit nounder/effect-start/examples/bun-preact target
```

## Development

### Configuration

`server.ts` is a main entrypoint for all environments. No more divergence between dev and prod!

It exports a layer that applies configuration and changes the behavior of the server:

```ts
import {
  BunTailwindPlugin,
  Start,
} from "effect-start"

export default Layer
  .mergeAll(
    // enable file-based router
    Start.router(() => import("./routes/_manifest")),
    // bundle client-side code for the browser
    Start.bundleClient({
      entrypoints: [
        "src/index.html",
      ],
      plugins: [
        // enable TailwindCSS for client bundle
        BunTailwindPlugin.make(),
      ],
    }),
  )
```

### File-based Routing

Effect Start provides automatic file-based routing with support for frontend pages, backend endpoints, and stackable layouts.

```
src/routes/
├── _layout.tsx          # Root layout
├── _page.tsx            # Home page (/)
├── about/
│   ├── _layout.tsx      # Nested layout for /about/*
│   └── _page.tsx        # Static route (/about)
├── users/
│   ├── _page.tsx        # Users list (/users)
│   └── $id/_page.tsx    # Dynamic route (/users/:id)
└── $/_page.tsx          # Splat/catch-all (/**)
```

```ts
import { FileRouter } from "effect-start"

// Generate route manifest and watch for changes
const routerLayer = FileRouter.layer(import.meta.resolve("routes"))
```

**Note:** Ensure `FileRouter.layer` is provided after any bundle layer to guarantee the manifest file is properly generated before bundling.

### Tailwind CSS Support

Effect Start includes built-in support for Tailwind CSS:

```ts
import { Layer } from "effect"
import { Start } from "effect-start"
import {
  BunBundle,
  BunTailwindPlugin,
} from "effect-start/bun"

const ClientBundle = BunBundle.bundleClient({
  entrypoints: [
    "./src/index.html",
  ],
  plugins: [
    BunTailwindPlugin.make(),
  ],
})

export default Layer.mergeAll(
  ClientBundle,
)

if (import.meta.main) {
  Start.serve(() => import("./server"))
}
```

Then in your main CSS files add following file:

```css
@import "tailwindcss";
```

### Running Examples Against Local Sources

To try the templates in `examples/` with your in-progress copy of Effect Start:

```sh
# from the repository root – register the local package once
bun link

# inside each example you want to run
cd examples/bun-preact
bun link effect-start
bun install            # optional, but keeps the lockfile tidy
bun run dev
```

Bun will symlink `node_modules/effect-start` to your workspace until you run `bun unlink effect-start` in that example.

### Static File Serving

```ts
import { HttpRouter } from "@effect/platform"
import { PublicDirectory } from "effect-start"

// Serve files from ./public directory
const PublicFiles = PublicDirectory.make()

HttpRouter.empty.pipe(
  HttpRouter.get("*", PublicFiles),
)
```
