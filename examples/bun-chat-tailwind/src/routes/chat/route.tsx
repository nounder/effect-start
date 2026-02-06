import { Ref } from "effect"
import { Route } from "effect-start"
import { HyperRoute } from "effect-start/hyper"
import { Message, messagesRef } from "../../Chat.tsx"

export default Route.get(
  HyperRoute.html(function* () {
    const messages = yield* Ref.get(messagesRef)

    return (
      <div
        class="h-full flex flex-col"
        data-signals={{
          draft: "",
          pendingDraft: "",
          username: "User" + Math.floor(Math.random() * 1000),
        }}
      >
        <div id="chat-messages" class="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
          {messages.map((m) => (
            <Message msg={m} />
          ))}
        </div>

        <form
          class="flex gap-2 p-2 border-t border-gray-200 bg-gray-50"
          data-on:submit__prevent="$pendingDraft = $draft; $draft = ''; @post('/chat/send')"
        >
          <input
            type="text"
            placeholder="Type a message..."
            data-bind:draft
            autocomplete="off"
            class="flex-1 py-3 px-3 border border-gray-300 rounded-lg text-base outline-none focus:border-emerald-500"
          />
          <button
            type="submit"
            data-indicator:sending
            data-attr:disabled="$sending || !$draft.trim()"
            class="py-3 px-6 border-none bg-emerald-500 text-white font-semibold rounded-lg cursor-pointer hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Send
          </button>
        </form>

        <div data-init="@get('/chat/stream')" />

        <script>
          {(window) => {
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

            const observer = new window.MutationObserver(() => {
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
)
