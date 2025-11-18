import { Route } from "effect-start"
import * as Effect from "effect/Effect"
import { DataService } from "../../../Data.ts"

export default Route.html(function*(ctx) {
  const data = yield* DataService
  const id = parseInt(ctx.params.id as string, 10)
  const show = data.getShowById(id)

  if (!show) {
    return yield* Effect.fail(
      Route.notFound({
        message: `Show with ID ${id} not found`,
      }),
    )
  }

  return (
    <div>
      <h1>{show.title}</h1>
      <p><strong>Years:</strong> {show.years}</p>
      <p><strong>Seasons:</strong> {show.seasons}</p>
      <p><strong>Creator:</strong> {show.creator}</p>
      <p><strong>Genre:</strong> {show.genre.join(", ")}</p>
      <p><strong>Rating:</strong> {show.rating}/10</p>
      <p><strong>Cast:</strong> {show.cast.join(", ")}</p>
      <div style="margin-top: 20px;">
        <h2>Plot</h2>
        <p>{show.plot}</p>
      </div>
      <div style="margin-top: 20px;">
        <a href="/shows">← Back to TV Shows</a>
      </div>
    </div>
  )
})
