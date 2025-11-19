import { Route } from "effect-start"

export default Route.layout(function(props) {
  return (
    <div>
      <h1>
        About layout
      </h1>
      {props.children}
    </div>
  )
})
