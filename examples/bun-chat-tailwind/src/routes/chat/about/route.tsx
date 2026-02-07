import { Route } from "effect-start"
import { HyperRoute, HyperHtml } from "effect-start/hyper"

export default Route.get(
  Route.html(function* () {
    return HyperHtml.renderToString(
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
