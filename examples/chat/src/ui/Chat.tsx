import { Effect, PubSub, Ref } from "effect"

export interface ChatMessage {
  id: string
  user: string
  text: string
  timestamp: number
}

export const messagesRef = Ref.makeUnsafe<Array<ChatMessage>>([])

export const chatPubSub = Effect.runSync(PubSub.unbounded<ChatMessage>())

export function Message(props: { msg: ChatMessage; isNew?: boolean }) {
  const time = new Date(props.msg.timestamp).toLocaleTimeString()
  const isUser = props.msg.user !== "Assistant"
  const animClass = props.isNew ? "msg-enter" : ""
  const timeClasses = isUser
    ? "block text-xs text-white/70 mt-1"
    : "block text-xs text-black/50 mt-1"

  if (isUser) {
    return (
      <div
        class={`max-w-[80%] rounded-lg px-4 py-3 ${animClass} ml-auto bg-emerald-500 text-white`}
      >
        <p>{props.msg.text}</p>
        <small class={timeClasses}>{time}</small>
      </div>
    )
  }
  return (
    <div class={`max-w-[80%] rounded-lg px-4 py-3 ${animClass} mr-auto bg-gray-100`}>
      <p>{props.msg.text}</p>
      <small class={timeClasses}>{time}</small>
    </div>
  )
}
