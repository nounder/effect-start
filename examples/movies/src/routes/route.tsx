import { Effect } from "effect"
import { Route } from "effect-start"

export default Route.html(function*() {
  return (
    <div>
      <h1>Movies Database</h1>
      <nav>
        <ul>
          <li><a href="/movies">Movies</a></li>
          <li><a href="/shows">TV Shows</a></li>
          <li><a href="/people">People</a></li>
          <li><a href="/login">Login</a></li>
          <li><a href="/register">Register</a></li>
        </ul>
      </nav>
    </div>
  )
})
