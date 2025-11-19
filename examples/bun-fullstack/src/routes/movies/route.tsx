import { Route } from "effect-start"

export default Route.html(function*() {
  return (
    <ul className="yoo">
      <li>
        <a href="/users/1">
          User 1
        </a>
      </li>
    </ul>
  )
})
