import { Effect, GlobalValue, PubSub, Ref } from "effect"

export interface ChatMessage {
  id: string
  user: string
  text: string
  timestamp: number
}

export const messagesRef = GlobalValue.globalValue(Symbol.for("app/messagesRef"), () =>
  Effect.runSync(Ref.make<Array<ChatMessage>>([])),
)

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
        class={`py-3 px-4 rounded-lg max-w-[80%] ${animClass} bg-emerald-500 text-white ml-auto`}
      >
        <p>{props.msg.text}</p>
        <small class={timeClasses}>{time}</small>
      </div>
    )
  }
  return (
    <div class={`py-3 px-4 rounded-lg max-w-[80%] ${animClass} bg-gray-100 mr-auto`}>
      <p>{props.msg.text}</p>
      <small class={timeClasses}>{time}</small>
    </div>
  )
}
