import { Effect, PubSub, Ref, Schema, Stream } from "effect"
import { Html, Route } from "effect-start"
import * as Chat from "../ui/Chat.tsx"

export default Route.get(
  Route.html(function* () {
    const messages = yield* Ref.get(Chat.messagesRef)

    return (
      <div
        class="flex h-full flex-col"
        data-signals={{
          _draft: "",
          username: "User" + Math.floor(Math.random() * 1000),
        }}
      >
        <div
          id="chat-messages"
          class="flex flex-1 flex-col gap-4 overflow-y-auto p-4"
        >
          {messages.map((m) => (
            <Chat.Message msg={m} />
          ))}
        </div>

        <form
          class="flex gap-2 border-t border-gray-200 bg-gray-50 p-2"
          data-on:submit={(e) => {
            e.preventDefault()

            e.actions.post(location.href, {
              payload: {
                username: e.signals.username,
                text: e.signals._draft,
              },
            })

            e.signals._draft = ""
          }}
        >
          <input
            id="draft"
            type="text"
            placeholder="Type a message..."
            data-bind="_draft"
            autocomplete="off"
            class="flex-1 rounded-lg border border-gray-300 px-3 py-3 text-base outline-none focus:border-emerald-500"
          />
          <button
            type="submit"
            data-indicator:sending
            data-attr:disabled={(e) => e.signals.sending || !e.signals._draft.trim()}
            class="cursor-pointer rounded-lg border-none bg-emerald-500 px-6 py-3 font-semibold text-white hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Send
          </button>
        </form>

        <div data-init={(e) => e.actions.get(location.href)} />

        <script>
          {() => {
            const scrollEl = window.document.getElementById("chat-messages")!
            let isAtBottom = true

            function checkIfAtBottom() {
              const threshold = 50
              isAtBottom =
                scrollEl.scrollHeight - scrollEl.scrollTop - scrollEl.clientHeight < threshold
            }

            function scrollToBottom() {
              if (scrollEl) scrollEl.scrollTop = scrollEl.scrollHeight
            }

            scrollEl.addEventListener("scroll", checkIfAtBottom)
            scrollToBottom()

            const observer = new MutationObserver(() => {
              if (isAtBottom) {
                window.requestAnimationFrame(scrollToBottom)
              }
            })
            observer.observe(scrollEl, {
              childList: true,
            })
          }}
        </script>
      </div>
    )
  }),
  Route.sse(
    Stream.fromPubSub(Chat.chatPubSub).pipe(
      Stream.map((msg: Chat.ChatMessage) => {
        const html = Html.text(
          <Chat.Message
            msg={msg}
            isNew
          />,
        )
        return {
          event: "datastar-patch-elements",
          data: ["selector #chat-messages", "mode append", `elements ${html}`],
        }
      }),
    ),
  ),
).post(
  Route.schemaBodyJson({
    text: Schema.String,
    username: Schema.String,
  }),
  Route.text(function* (ctx) {
    if (!ctx.body.text?.trim()) {
      return ""
    }

    const userMessage: Chat.ChatMessage = {
      id: crypto.randomUUID(),
      user: ctx.body.username || "Anonymous",
      text: ctx.body.text.trim(),
      timestamp: Date.now(),
    }

    yield* Ref.update(Chat.messagesRef, (msgs) => [...msgs, userMessage])
    yield* PubSub.publish(Chat.chatPubSub, userMessage)

    // simulate inference
    yield* Effect.sleep(100)

    const assistantMessage: Chat.ChatMessage = {
      id: crypto.randomUUID(),
      user: "Assistant",
      text: "I don't understand",
      timestamp: Date.now(),
    }

    yield* Ref.update(Chat.messagesRef, (msgs) => [...msgs, assistantMessage])
    yield* PubSub.publish(Chat.chatPubSub, assistantMessage)

    return ""
  }),
)
