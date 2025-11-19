import { Route } from "effect-start"

export default Route.html(function*(ctx) {
  return (
    <div>
      Movie ID from URL: {ctx.url.pathname}
    </div>
  )
})
