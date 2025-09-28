import { Route } from "effect-start"

export default Route.page(function(props) {
  return (
    <div>
      Users {props.params.id} Page
    </div>
  )
})
