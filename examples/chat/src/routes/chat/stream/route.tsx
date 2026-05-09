import { Stream } from "effect"
import { Route } from "effect-start"
import * as Html from "effect-start/Html"
import * as Chat from "ui/Chat.tsx"

const chatPatchMessage = (msg: Chat.ChatMessage) => {
  const html = Html
    .text(<Chat.Message msg={msg} isNew />)
  return {
    type: "datastar-patch-elements",
    data: [
      "selector #chat-messages",
      "mode append",
      `elements ${html}`,
    ],
  }
}

export default Route.get(
  Route.sse(
    Stream.fromPubSub(Chat.chatPubSub).pipe(
      Stream.map(chatPatchMessage),
    ),
  ),
)
