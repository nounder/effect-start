import { Route } from "effect-start"
import * as Html from "effect-start/Html"

export default Route.get(
  Route.html(function* () {
    return Html.renderToString(
      <div data-signals={{ a: 2 }}>
        <h1>hello</h1>
        <span data-text={() => "hello" + 23}></span>
        <buton class="bg-red-500" data-on:click={(ctx) => ctx.window.alert("aaa")}>
          aa
        </buton>
      </div>,
    )
  }),
)
