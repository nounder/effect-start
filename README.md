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
  Router,
  Start,
} from "effect-start"

export default Start.layer(
  Router.layerFiles({
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

Install Tailwind plugin:

```sh
bun add tailwindcss bun-plugin-tailwind
```

In `bunfig.toml`:

```toml
[serve.static]
plugins = ["bun-plugin-tailwind"]
```

Finally, include it in your `src/app.html`:

```html
<!doctype html>
<html>
  <head>
    <link rel="stylesheet" href="tailwindcss" />
  </head>
  <!-- the rest of your HTML... -->
</html>
```
