import { Route } from "effect-start"

export default Route.html(function*() {
  return `
    <ul class="yoo">
      <li>
        <a href="/movies/1">Movie 1</a>
      </li>
      <li>
        <a href="/movies/2">Movie 2</a>
      </li>
    </ul>
  `
})
