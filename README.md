# Effect Start

Build declarative full-stack apps with Effect.

This project is in its early stage. However, the code is well documented so you should be able to figure out how to use it
by checking out `examples/` directory.

## Development

### Configuration

`server.ts` is a main entrypoint for all environments. No more divergence between dev and prod!

It exports a layer that applies configuration and changes the behavior of the server:

```typescript
import { Start } from "effect-start"
import { BunTailwindPlugin } from "effect-start/bun"

export default Start.make(
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
import { Start } from "effect-start"
import { BunTailwindPlugin } from "effect-start/bun"

const ClientBundle = Start.bundleClient({
  entrypoints: [
    "./src/index.html",
  ],
  plugins: [
    BunTailwindPlugin.make(),
  ],
})

export default Start.make(
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

### Cloudflare Tunnel

Tunnel your local server to the Internet with `cloudflared`

```ts
import { Start } from "effect-start"
import { CloudflareTunnel } from "effect-start/x/cloudflare"

export default Start.make(
  CloudflareTunnel.layer(),
)

if (import.meta.main) {
  Start.serve(() => import("./server"))
}
```
