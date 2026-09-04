# Effect Start

Build declarative full-stack apps with Effect.

This project is in its early stage. However, the code is well documented so you should be able to figure out how to use it
by checking out `examples/` directory.

## Development

### Configuration

`server.ts` is a main entrypoint for all environments. No more divergence between dev and prod!

It exports a layer that applies configuration and changes the behavior of the server:

```typescript
import { FileRouter, Start } from "effect-start"

export default Start.layer(
  FileRouter.layer(),
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
└── route.tsx
```

`FileRouter.layer()` scans `src/routes` and builds the route map in memory —
no generated manifest file is ever written next to your routes, so there's
nothing there for an agent (or you) to accidentally edit.

If you need typed `DevRoutes` support, pass `load`/`path` to have
`FileRouter.layer()` maintain a `.server.ts` manifest instead:

```typescript
FileRouter.layer({
  load: () => import("./routes/.server.ts"),
  path: import.meta.resolve("./routes/.server.ts"),
})
```

This does write a real file, so treat it like a build artifact (e.g. add it
to `.gitignore`). When bundling into a single deployable artifact, prefer
serving the manifest as a virtual module via a bundler plugin — see
`BunFileRouterPlugin` in `effect-start/bun` — so no manifest file exists on
disk even for bundled builds.

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
plugins = ["effect-start/tailwind"]
```

Finally, include it in your `src/app.css`:

```html
@import "tailwindcss";
```
