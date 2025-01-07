import { hydrate } from "solid-js/web"
import App from "./App.tsx"

// TODO: why do we need render a component before passing it to hydrate
// for it to work?
// docs says it should be () => JSX.Element
// see: https://docs.solidjs.com/reference/rendering/hydrate

hydrate(<App />, document.body)
