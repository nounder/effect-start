/** @jsxImportSource effect-start */
import { Context, Effect, Layer, PubSub, Ref, Schema, Stream } from "effect"
import { Bundle, Html, Route, Start } from "effect-start"
import { BunBundle } from "effect-start/bun"

type Message = {
  id: string
  user: string
  text: string
  timestamp: number
}

class Chat extends Context.Service<
  Chat,
  {
    readonly messages: Ref.Ref<Array<Message>>
    readonly events: Stream.Stream<Message>
    readonly send: (user: string, text: string) => Effect.Effect<void>
  }
>()("Chat") {}

function ChatMessage(props: { message: Message; isNew?: boolean }) {
  return (
    <div
      class={`message ${props.message.user === "Assistant" ? "assistant" : "user"}${props.isNew ? " entering" : ""}`}
    >
      <strong>{props.message.user}</strong>
      <p>{props.message.text}</p>
      <small>{new Date(props.message.timestamp).toLocaleTimeString()}</small>
    </div>
  )
}

const routes = Route.map({
  "*": Route.use(
    Route.html(function*(_ctx, next) {
      const bundle = yield* Bundle.Bundle

      return (
        <html>
          <head>
            <meta name="viewport" content="width=device-width, initial-scale=1" />
            <title>Chat</title>
            <style>
              {`
                * { box-sizing: border-box; }
                html, body { height: 100%; margin: 0; }
                body { font-family: system-ui, sans-serif; color: #1f2937; background: #f8fafc; }
                .chat { display: flex; flex-direction: column; height: 100%; max-width: 880px; margin: auto; background: white; box-shadow: 0 0 24px #0f172a0d; }
                header { padding: 16px 20px; border-bottom: 1px solid #e5e7eb; font-size: 1.15rem; font-weight: 700; }
                #chat-messages { display: flex; flex: 1; flex-direction: column; gap: 16px; overflow-y: auto; padding: 20px; }
                .message { max-width: 80%; padding: 12px 16px; border-radius: 12px; overflow-wrap: anywhere; }
                .message p { margin: 6px 0; white-space: pre-wrap; }
                .message small { display: block; opacity: .65; }
                .message.user { align-self: flex-end; color: white; background: #059669; }
                .message.assistant { align-self: flex-start; background: #f1f5f9; }
                .entering { animation: slide-in .2s ease-out; }
                form { display: flex; gap: 8px; padding: 12px; border-top: 1px solid #e5e7eb; }
                input { flex: 1; min-width: 0; padding: 12px; border: 1px solid #cbd5e1; border-radius: 8px; font: inherit; }
                input:focus { outline: 2px solid #10b981; outline-offset: 1px; }
                button { padding: 12px 24px; border: 0; border-radius: 8px; color: white; background: #059669; font: inherit; font-weight: 600; cursor: pointer; }
                button:hover { background: #047857; }
                button:disabled { opacity: .5; cursor: not-allowed; }
                @keyframes slide-in { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
              `}
            </style>
            <script type="module" src={bundle.resolve("effect-start/datastar")}></script>
          </head>
          <body>{yield* next.html}</body>
        </html>
      )
    }),
  ),
  "/": Route
    .get(
      Route.html(function*() {
        const chat = yield* Chat
        const messages = yield* Ref.get(chat.messages)

        return (
          <main
            class="chat"
            data-signals={{ _draft: "", username: `User${Math.floor(Math.random() * 1000)}` }}
            data-init={(e) => e.actions.get(location.href)}
          >
            <header>Chat</header>
            <div id="chat-messages">
              {messages.map((message) => <ChatMessage message={message} />)}
            </div>
            <form
              data-on:submit={(e) => {
                e.preventDefault()
                e.actions.post(location.href, {
                  payload: { username: e.signals.username, text: e.signals._draft },
                })
                e.signals._draft = ""
              }}
            >
              <input type="text" placeholder="Type a message..." data-bind="_draft" autocomplete="off" />
              <button
                type="submit"
                data-indicator:sending
                data-attr:disabled={(e) => e.signals.sending || !e.signals._draft.trim()}
              >
                Send
              </button>
            </form>
            <script>
              {() => {
                const messages = document.getElementById("chat-messages")!
                let atBottom = true
                messages.addEventListener("scroll", () => {
                  atBottom = messages.scrollHeight - messages.scrollTop - messages.clientHeight < 50
                })
                messages.scrollTop = messages.scrollHeight
                new MutationObserver(() => {
                  if (atBottom) requestAnimationFrame(() => messages.scrollTop = messages.scrollHeight)
                }).observe(messages, { childList: true })
              }}
            </script>
          </main>
        )
      }),
      Route.sse(function*() {
        const chat = yield* Chat
        return chat.events.pipe(
          Stream.map((message) => ({
            event: "datastar-patch-elements",
            data: [
              "selector #chat-messages",
              "mode append",
              `elements ${Html.text(<ChatMessage message={message} isNew />)}`,
            ],
          })),
        )
      }),
    )
    .post(
      Route.schemaBodyJson({
        text: Schema.String,
        username: Schema.String,
      }),
      Route.text(function*(ctx) {
        const text = ctx.body.text.trim()
        if (!text) return ""

        const chat = yield* Chat
        yield* chat.send(ctx.body.username || "Anonymous", text)
        yield* Effect.sleep(100)
        yield* chat.send("Assistant", "I don't understand")
        return ""
      }),
    ),
})

const chatLayer = Layer.effect(
  Chat,
  Effect.gen(function*() {
    const messages = yield* Ref.make<Array<Message>>([])
    const pubsub = yield* PubSub.unbounded<Message>()

    return {
      messages,
      events: Stream.fromPubSub(pubsub),
      send: (user: string, text: string) =>
        Effect.gen(function*() {
          const message = { id: crypto.randomUUID(), user, text, timestamp: Date.now() }
          yield* Ref.update(messages, (current) => [...current, message])
          yield* PubSub.publish(pubsub, message)
        }),
    }
  }),
)

if (import.meta.main) {
  Start.serve(Start.pack(
    Route.layer(routes),
    chatLayer,
    BunBundle.layer({
      entrypoints: ["effect-start/datastar"],
      ignoreDCEAnnotations: true,
    }),
  ))
}
