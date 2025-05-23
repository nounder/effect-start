# Full-stack Solid.js with Effect Bundler & Bun

A declarative full-stack Effect.ts and Solid.js with:

- distributed observability,
- fast development and production builds (thanks to Bun),
- live reloading for great development experience and no restarts between edits.

Our philosophy is this: Effect is good and if you relay on it your software will be good too.

One of the thing that distinguish Effect Bundler from other full-stack frameworks is that it's not a framework, it's a library. There are no config files or structure that you have to adhere to.

There's no under-the-hood or magic. Everything that happens starts in `src/dev.ts`. What you see is what you get.

Effect Bundler provides composable fully effectful abstractions that you can use in your app without being forced to go all in.

# Usage

```sh
# Install all dependencies
bun install

# start a development server
bun start

# build for production
bun run build
```

# Structure

- `client.tsx` is client entrypoint where initial browser code is ran.
- `server.ts` is server entrypoint that runs API and exposes client code

# Production

Run `bun start`
