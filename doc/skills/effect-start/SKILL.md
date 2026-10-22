---
name: effect-start
description: Setup Effect Start app, server, layers, bundles, and routing.
---

A minimal Effect Start app looks like this:

```tsx
import { Effect, Schema, Stream } from "effect"
import * as RouteError from "effect-start/RouteError"
import {
  Entity,
  FileRouter, // file-based routing from `routes/` directory
  Html, // render HTML from h() or JSX
  Password,
  Route, // define routes
  Start, // setup Start app
  Unique,
} from "effect-start"

// define map of routes
const routes = Route.map({
  // a middleware that applies to all routes under it
  "*": Route.use(
    // only applies to HTML requests
    Route.html(function*(_ctx, next) {
      return (
        <html>
          <head>
            <title>
              App
            </title>
          </head>
          <body class="bg-black text-white">
            <div>
              {yield* next.html}
            </div>
          </body>
        </html>
      )
    }),
    // wraps all JSON route that fail
    Route.json(function*(_ctx, next) {
      return yield* next.pipe(
        Effect.catch((e) =>
          Effect.succeed(Entity.make(
            { error: String(e) },
            { status: (e as unknown) instanceof RouteError.Unauthorized ? 401 : 500 },
          ))
        ),
      )
    }),
  ),
  "/": Route.get(
    Route.redirect("/todos"),
  ),
  "/todos": {
    "/": Route
      // renders all todos
      .get(
        Route.html(function*() {
          const todos = yield* Store.allTodos

          return (
            <div>
              <div>
                Items
              </div>
              <ul id="list">
                {todos.map((todo) => <TodoItem {...todo} />)}
              </ul>
              <form action="/todos" method="post">
                <input name="text" type="text" required />
                <button type="submit">
                  add
                </button>
              </form>
              <script>
                {/* JSX <script /> accepts type-safe functions that are executed in the browser */}
                {(window) => {
                  const events = new EventSource(location.href)

                  events.addEventListener("patch", (e) => {
                    const [, mode, selector, html] = e.data.match(
                      /^(\S+) (\S+)\n([\s\S]*)/,
                    )!
                    const target = document.querySelector(selector)

                    target?.[mode]?.(
                      document.createRange().createContextualFragment(html),
                    )
                  })
                }}
              </script>
            </div>
          )
        }),
        // stream server-sent events
        Route.sse(function*() {
          const store = yield* Store.Store

          return store.events.pipe(
            Stream.map((e) => ({
              event: "patch",
              data: [
                e._tag === "Add"
                  ? "append #list"
                  : `replaceWith #todo-${e.todo.id}`,
                Html.text(<TodoItem {...e.todo} />),
              ],
            })),
          )
        }),
      )
      // POST form
      .post(
        Route.schemaBodyForm({
          text: Schema.String,
        }),
        Route.handle(function*(ctx) {
          const store = yield* Store.Store
          yield* store.add({
            id: Unique.uuid7(),
            token: Unique.token(),
            text: ctx.body.text,
          })

          return Route.redirect("/todos", { status: 303 })
        }),
      ),
    "/:id/toggle": Route.post(
      // type-safe parameters and payload
      Route.schemaPathParams({
        id: Schema.String,
      }),
      Route.schemaBodyJson({
        done: Schema.Boolean,
      }),
      Route.json(function*(ctx) {
        const store = yield* Store.Store

        // everything is typed!
        yield* store.toggle(ctx.pathParams.id, ctx.body.done)

        return { ok: true }
      }),
    ),
  },
  "/api/users": {
    "*": Route.use(
      Route.schemaHeaders({ authorization: Schema.optional(Schema.String) }),
      Route.filter(function*(ctx) {
        const authorization = ctx.headers.authorization?.split(" ")
        const token = authorization?.[0] === "Bearer" ? authorization[1] : undefined
        const user = token ? yield* UserRepo.findByToken(token) : undefined

        if (!user) return yield* Effect.fail(new RouteError.Unauthorized({ message: "Login required" }))
        return { context: { user } }
      }),
    ),
    "/": Route.post(
      Route.schemaBodyJson({
        email: Schema.String,
        password: Schema.String,
      }),
      Route.json(function*(ctx) {
        const password = yield* Password.hash(ctx.body.password)
        const user = yield* UserRepo.create(ctx.body.email, password)

        return { id: user.id }
      }),
    ),
  },
  "/login": Route.post(
    Route.schemaBodyJson({
      email: Schema.String,
      password: Schema.String,
    }),
    Route.json(function*(ctx) {
      const user = yield* UserRepo.find(ctx.body.email)
      const valid = yield* Password.verify(ctx.body.password, user.password)

      if (!valid) return Entity.make({ error: "Invalid credentials" }, { status: 401 })

      const token = Unique.token()
      yield* UserRepo.saveToken(user.id, token)

      return { token }
    }),
  ),
})

export default Start.pack(Route.layer(routes))

Start.runMain(import.meta)
```

## File-based router

Alternatively, you can provide `FileRouter.layer()` and all routes will be automatically found
in `routes/` directory:

```
src/routes/
  route.tsx               /
  layer.tsx               middleware for descendants
  users/[id]/route.ts      /users/:id
  (pages)/about/route.tsx   /about
  [[rest]]/route.tsx       /:rest*
```

## Datastar

Effect Start comes with small Datastar fork

```tsx
import { BunBundle } from "effect-start/bun"
import { Bundle } from "effect-start"

export default Start.pack(
  Route.layer(Route.map({
    "*": Route.use(
      Route.html(function*(_, next) {
        const bundle = yield* Bundle.Bundle
        return (
          <html>
            <head>
              <script
                type="module"
                src={bundle.resolve("effect-start/datastar")}
              ></script>
            </head>
            <body>{yield* next.html}</body>
          </html>
        )
      }),
    ),
    "/": Route
      .get(
        Route.html(function*() {
          return (
            <div data-signals={{ draft: "" }}>
              <ul id="messages"></ul>
              <form
                data-on:submit={(e) => {
                  e.preventDefault()
                  e.actions.post(location.href, { payload: { text: e.signals.draft } })
                  e.signals.draft = ""
                }}
              >
                <input
                  data-bind="draft"
                  data-init={(e) => e.currentTarget.focus()}
                />
                <button
                  data-attr:disabled={(e) => !e.signals.draft.trim()}
                >Send</button>
              </form>
              <small><span data-text={e => e.signals.draft.length} /> characters</small>
            </div>
          )
        }),
      )
      .post(
        Route.schemaBodyJson({ text: Schema.String }),
        Route.sse((ctx) =>
          Stream.succeed({
            event: "datastar-patch-elements",
            data: [
              "selector #messages",
              "mode append",
              `elements ${Html.text(<li>{ctx.body.text}</li>)}`,
            ],
          })
        ),
      ),
  })),
  BunBundle.layer({ entrypoints: ["effect-start/datastar"] }),
)
```

## Tailwind CSS

Install `tailwindcss` package to use integration with Effect Start:

```tsx
import { TailwindPlugin } from "effect-start/tailwind"

export default Start.pack(
  Route.layer(Route.map({
    "*": Route.use(
      Route.html(function*(_, next) {
        const bundle = yield* Bundle.Bundle
        return (
          <html>
            <head>
              <link
                rel="stylesheet"
                href={bundle.resolve("./app.css")}
              />
            </head>
            <body>{yield* next.html}</body>
          </html>
        )
      }),
    ),
  })),
  BunBundle.layer({
    entrypoints: [import.meta.resolve("./app.css")],
    plugins: [TailwindPlugin.make()],
  }),
)
```

In `app.css`:

```css
// enable tailwind and scan for classes in this directory
@import "tailwindcss" source(".");
```

## Oxlint

Install `oxlint` with `bun add -D oxlint`, then create `oxlint.config.ts`:

```ts
import * as LintConfig from "effect-start/lint/config"
import { defineConfig } from "oxlint"

export default defineConfig({
  extends: [LintConfig.config],
  rules: {
    ...LintConfig.formatRules,
    ...LintConfig.ourRules,
  },
  ignorePatterns: ["dist/", "*.gen.ts"],
})
```

Run `bunx oxlint`.

## SQL and migrations

Install `@effect/sql-sqlite-bun` and `@effect/platform-bun` at your Effect version. Pass their SQLite, filesystem, and path layers to `Start.pack`. The migrator discovers files like `FileRouter` discovers routes:

```ts
import { Schema } from "effect"
import { SqlClient } from "effect/sql"
import { Route, Start } from "effect-start"
import { BunFileSystem, BunPath } from "@effect/platform-bun"
import { SqliteClient, SqliteMigrator } from "@effect/sql-sqlite-bun"

export default Start.pack(
  Route.layer(Route.map({
    "/users/:id": Route.get(
      Route.schemaPathParams({ id: Schema.String }),
      Route.json(function*(ctx) {
        const sql = yield* SqlClient.SqlClient
        const users = yield* sql<{ id: string; email: string }>`
          select id, email from User where id = ${ctx.pathParams.id}
        `
        return users[0] ?? null
      }),
    ),
  })),
  BunFileSystem.layer,
  BunPath.layer,
  SqliteClient.layer({ filename: "./db.sqlite3" }),
  SqliteMigrator.layer({
    table: "_migrations",
    loader: SqliteMigrator.fromFileSystem("./db/migrations"),
  }),
)
```

Put migrations in `db/migrations/`, under file time ordered name like `20261014230000_CreateUser.ts`:

```ts
import { Effect } from "effect"
import { SqlClient } from "effect/sql"

export default Effect.gen(function*() {
  const sql = yield* SqlClient.SqlClient
  yield* sql`create table User (id text primary key, email text not null unique)`
})
```
