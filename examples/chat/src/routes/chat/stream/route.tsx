import { Stream } from "effect"
import { Route } from "effect-start"
import * as Html from "effect-start/Html"
import { type ChatMessage, chatPubSub, Message } from "../../../Chat.tsx"

const chatPatchMessage = (msg: ChatMessage) => {
  const html = Html.renderToString(<Message msg={msg} isNew />).replace(/\n/g, "")
  return {
    type: "datastar-patch-elements",
    data: `selector #chat-messages\nmode append\nelements ${html}`,
  }
}

export default Route.get(
  Route.sse(Stream.fromPubSub(chatPubSub).pipe(Stream.map(chatPatchMessage))),
)
