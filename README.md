# Effect Start

Build declarative full-stack apps with Effect.

This project is in its early stage. However, the code is well documented so you should be able to figure out how to use it
by checking out `examples/` directory.

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
    load: () => import("./routes/manifest.ts"),
    path: import.meta.resolve("./routes/manifest.ts"),
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
│   └── route.ts
├── admin
│   ├── data.json
│   │   └── route.tsx
│   ├── layer.tsx
│   └── route.tsx
├── layer.tsx
├── manifest.ts
└── route.tsx
```

### Tailwind CSS Support

Effect Start comes with native Tailwind support that is lightweight and
works with minimal setup.

First, install Tailwind package:

```sh
bun add tailwindcss
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
