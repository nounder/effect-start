/** @jsxImportSource effect-start */
import { Context, Effect, Layer, PubSub, Ref, Schema, Stream } from "effect"
import { Start, Route, Html } from "effect-start"

type Todo = { id: string; text: string; done: boolean }
type TodoEvent =
  | { _tag: "Add"; todo: Todo }
  | { _tag: "Update"; todo: Todo }

class Store extends Context.Tag("Store")<
  Store,
  {
    readonly todos: Ref.Ref<Todo[]>
    readonly events: Stream.Stream<TodoEvent>
    readonly add: (text: string) => Effect.Effect<{ id: string }>
    readonly toggle: (id: string, done: boolean) => Effect.Effect<void>
  }
>() {}

const routes = Route.map({
  "*": Route.use(
    Route.html(function* (_ctx, next) {
      return (
        <html>
          <head>
            <title>Hello</title>
          </head>
          <body class="bg-black text-white">
            <div>{yield* next().text}</div>
          </body>
        </html>
      )
    }),
  ),
  "/": Route.get(Route.redirect("/todos")),
  "/todos": Route
    // renders todo lists
    .get(
      Route.html(function* () {
        const store = yield* Store
        const todos = yield* Ref.get(store.todos)

        return (
          <div>
            <div>Items</div>
            <ul id="list">
              {todos.map((todo) => (
                <TimeItem {...todo} />
              ))}
            </ul>
            <form
              onsubmit={(e) => {
                e.preventDefault()
                const form = e.currentTarget as HTMLFormElement
                const input = form.elements.namedItem("text") as HTMLInputElement
                fetch(location.href, {
                  method: "POST",
                  headers: { "content-type": "application/json" },
                  body: JSON.stringify({ text: input.value }),
                })
                input.value = ""
              }}
            >
              <input name="text" type="text" required />
              <button type="submit">add</button>
            </form>
            <script>
              {() => {
                const events = new EventSource(location.href)

                events.addEventListener("patch", (e) => {
                  const [, mode, selector, html] = e.data.match(/^(\S+) (\S+)\n([\s\S]*)/)!
                  const target = document.querySelector(selector)

                  target?.[mode]?.(document.createRange().createContextualFragment(html))
                })
              }}
            </script>
          </div>
        )
      }),
      // streams it
      Route.sse(function* () {
        const store = yield* Store

        return store.events.pipe(
          Stream.map((e) => ({
            event: "patch",
            data: [
              e._tag === "Add" ? "append #list" : `replaceWith #todo-${e.todo.id}`,
              Html.text(<TimeItem {...e.todo} />),
            ],
          })),
        )
      }),
    )
    ///
    .post(
      Route.schemaBodyJson({
        text: Schema.String,
      }),
      Route.json(function* (ctx) {
        const store = yield* Store
        const newTodo = yield* store.add(ctx.body.text)

        return newTodo
      }),
    ),
  "/todos/:id/toggle": Route.post(
    Route.schemaPathParams({
      id: Schema.String,
    }),
    Route.schemaBodyJson({
      done: Schema.Boolean,
    }),
    Route.json(function* (ctx) {
      const store = yield* Store
      yield* store.toggle(ctx.pathParams.id, ctx.body.done)
      return { ok: true }
    }),
  ),
})

const layerStore = Layer.effect(
  Store,
  Effect.gen(function* () {
    const todos = yield* Ref.make<Todo[]>([])
    const pubsub = yield* PubSub.unbounded<TodoEvent>()

    return {
      todos,
      events: Stream.fromPubSub(pubsub),
      add: (text) =>
        Effect.gen(function* () {
          const id = Math.random().toString(36).slice(2, 8)
          const todo: Todo = { id, text, done: false }
          yield* Ref.update(todos, (curr) => [...curr, todo])
          yield* PubSub.publish(pubsub, { _tag: "Add" as const, todo })
          return { id }
        }),
      toggle: (id, done) =>
        Effect.gen(function* () {
          const updated = yield* Ref.modify(todos, (curr) => {
            let next: Todo | undefined
            const arr = curr.map((todo) => {
              if (todo.id !== id) return todo
              next = { ...todo, done }
              return next
            })
            return [next, arr]
          })
          if (updated) yield* PubSub.publish(pubsub, { _tag: "Update" as const, todo: updated })
        }),
    }
  }),
)

function TimeItem(props: { id: string; text: string; done: boolean }) {
  return (
    <li id={`todo-${props.id}`}>
      <input
        type="checkbox"
        checked={props.done}
        data-id={props.id}
        onchange={(e) => {
          fetch(`/todos/${e.currentTarget.dataset.id}/toggle`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ done: e.currentTarget.checked }),
          })
        }}
      />
      <span style={props.done ? "text-decoration: line-through" : ""}>{props.text}</span>
    </li>
  )
}

if (import.meta.main) {
  const app = Start.build(Route.layer(routes), layerStore)

  Start.serve(app)
}
