import {
  Duration,
  Effect,
  GlobalValue,
  PubSub,
  Ref,
  Schedule,
  Stream,
} from "effect"
import {
  Entity,
  Route,
} from "effect-start"
import { BunRoute } from "effect-start/bun"

interface ChatMessage {
  id: string
  user: string
  text: string
  timestamp: number
}

const messagesRef = GlobalValue.globalValue(
  Symbol.for("app/messagesRef"),
  () => Effect.runSync(Ref.make<Array<ChatMessage>>([])),
)
const chatPubSub = Effect.runSync(PubSub.unbounded<ChatMessage>())

const renderMessage = (msg: ChatMessage, isNew = false) => {
  const time = new Date(msg.timestamp).toLocaleTimeString()
  const isUser = msg.user !== "Assistant"
  const animClass = isNew ? "msg-enter" : ""
  const timeClasses = isUser
    ? "block text-xs text-white/70 mt-1"
    : "block text-xs text-black/50 mt-1"
  if (isUser) {
    return `<div class="py-3 px-4 rounded-lg max-w-[80%] ${animClass} bg-emerald-500 text-white ml-auto"><p>${msg.text}</p><small class="${timeClasses}">${time}</small></div>`
  }
  return `<div class="py-3 px-4 rounded-lg max-w-[80%] ${animClass} bg-gray-100 mr-auto"><p>${msg.text}</p><small class="${timeClasses}">${time}</small></div>`
}

const chatPatchMessage = (msg: ChatMessage) => {
  const html = renderMessage(msg, true).replace(/\n/g, "")
  return `event: datastar-patch-elements
data: selector #chat-messages
data: mode append
data: elements ${html}

`
}

export default Route.tree({
  "*": Route.use(
    BunRoute.htmlBundle(() => import("./app.html")),
  ),
  "/": Route.get(
    Route.html(function*() {
      const messages = yield* Ref.get(messagesRef)
      const messagesHtml = messages.map((m) => renderMessage(m)).join("")

      return `
    <div
      class="h-full flex flex-col"
      data-signals="{draft: '', pendingDraft: '', username: 'User' + Math.floor(Math.random() * 1000)}"
    >
      <div id="chat-messages" class="flex-1 overflow-y-auto p-4 flex flex-col gap-4">${messagesHtml}</div>

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

      <div data-init="@get('/chat/stream')"></div>
    </div>

    <script>
    const scrollEl = document.getElementById('chat-messages');
    let isAtBottom = true;
    
    function checkIfAtBottom() {
      const threshold = 50;
      isAtBottom = scrollEl.scrollHeight - scrollEl.scrollTop - scrollEl.clientHeight < threshold;
    }
    
    function scrollToBottom() {
      if (scrollEl) scrollEl.scrollTop = scrollEl.scrollHeight;
    }
    
    scrollEl.addEventListener('scroll', checkIfAtBottom);
    scrollToBottom();
    
    const observer = new MutationObserver(() => {
      if (isAtBottom) {
        requestAnimationFrame(scrollToBottom);
      }
    });
    observer.observe(scrollEl, { childList: true });
    </script>`
    }),
  ),
  "/send": Route.post(
    Route.text(function*(ctx) {
      const body = yield* Effect.tryPromise(() => ctx.request.json())
      const { pendingDraft, username } = body as {
        pendingDraft: string
        username: string
      }

      if (!pendingDraft?.trim()) {
        return ""
      }

      const userMessage: ChatMessage = {
        id: crypto.randomUUID(),
        user: username || "Anonymous",
        text: pendingDraft.trim(),
        timestamp: Date.now(),
      }

      yield* Ref.update(messagesRef, (msgs) => [...msgs, userMessage])
      yield* PubSub.publish(chatPubSub, userMessage)

      yield* Effect.sleep(200)

      const assistantMessage: ChatMessage = {
        id: crypto.randomUUID(),
        user: "Assistant",
        text: "I don't understand",
        timestamp: Date.now(),
      }

      yield* Ref.update(messagesRef, (msgs) => [...msgs, assistantMessage])
      yield* PubSub.publish(chatPubSub, assistantMessage)

      return `event: datastar-patch-signals\ndata: signals {"message":""}\n\n`
    }),
  ),
  "/stream": Route.get(
    Route.text(function*() {
      const heartbeat = Stream.repeat(
        Stream.succeed(":\n\n"),
        Schedule.spaced(Duration.seconds(5)),
      )

      const messages = Stream.unwrapScoped(
        Effect.gen(function*() {
          const subscription = yield* PubSub.subscribe(chatPubSub)
          return Stream.fromQueue(subscription).pipe(
            Stream.map(chatPatchMessage),
          )
        }),
      )

      const stream = Stream.merge(heartbeat, messages)

      return Entity.make(stream, {
        headers: {
          "content-type": "text/event-stream",
          "cache-control": "no-cache",
          "connection": "keep-alive",
        },
      })
    }),
  ),
})
