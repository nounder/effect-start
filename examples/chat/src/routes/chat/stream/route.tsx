import { Stream } from "effect"
import { Route } from "effect-start"
import * as Html from "effect-start/Html"
import * as Chat from "../../../Chat.tsx"

const chatPatchMessage = (msg: Chat.ChatMessage) => {
  const html = Html.text(<Chat.Message msg={msg} isNew />).replace(/\n/g, "")
  return {
    type: "datastar-patch-elements",
    data: `selector #chat-messages\nmode append\nelements ${html}`,
  }
}

export default Route.get(
  Route.sse(
    Stream.fromPubSub(Chat.chatPubSub).pipe(Stream.map(chatPatchMessage)),
  ),
)
