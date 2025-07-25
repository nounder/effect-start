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

### Configuration in server.ts

`server.ts` is where all configuration lives. It's a typescript file run to be your dev server and run to be your production server as well. YES environment can be the same. No more divergence between dev and prod! What you see is what you get.

To configure server.ts notice that the bundleClient creation passed on the configuration from [bun build](https://bun.sh/docs/bundler).

When adding features like File-based routing or Tailwind support you will provide Layers to the `exportdefault Layer.mergeAll(...)` function.

To make a Layer for Effect-Start features you will import from "effect-start" and see how it turns into a Layer e.g. via the `.layer` or `.make` function.
From there you add the layer to the `Layer.mergeAll()` array. Notice potential order conflicts like Filebased routing needing to be after your Bundle layer!

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
