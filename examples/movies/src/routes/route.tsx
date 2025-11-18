import { Route } from "effect-start"

export default Route.html(function*() {
  return (
    <div>
      <h1>Movies Demo App</h1>
      <nav>
        <ul>
          <li>
            <a href="/shows">TV Shows</a>
          </li>
          <li>
            <a href="/people">People</a>
          </li>
          <li>
            <a href="/login">Login</a>
          </li>
          <li>
            <a href="/register">Register</a>
          </li>
        </ul>
      </nav>
    </div>
  )
})
