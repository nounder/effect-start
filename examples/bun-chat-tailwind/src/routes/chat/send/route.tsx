import {
  Effect,
  PubSub,
  Ref,
} from "effect"
import { Route } from "effect-start"
import {
  type ChatMessage,
  chatPubSub,
  messagesRef,
} from "../../../Chat.tsx"

export default Route.post(
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
)
