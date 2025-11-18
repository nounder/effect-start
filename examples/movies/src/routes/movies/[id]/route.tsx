import { Route } from "effect-start"
import * as Effect from "effect/Effect"
import { DataService } from "../../../Data.ts"

export default Route.html(function*(ctx) {
  const data = yield* DataService
  const id = parseInt(ctx.params.id as string, 10)
  const movie = data.getMovieById(id)

  if (!movie) {
    return yield* Effect.fail(
      Route.notFound({
        message: `Movie with ID ${id} not found`,
      }),
    )
  }

  return (
    <div>
      <h1>{movie.title} ({movie.year})</h1>
      <p><strong>Director:</strong> {movie.director}</p>
      <p><strong>Genre:</strong> {movie.genre.join(", ")}</p>
      <p><strong>Rating:</strong> {movie.rating}/10</p>
      <p><strong>Cast:</strong> {movie.cast.join(", ")}</p>
      <div style="margin-top: 20px;">
        <h2>Plot</h2>
        <p>{movie.plot}</p>
      </div>
      <div style="margin-top: 20px;">
        <a href="/movies">← Back to Movies</a>
      </div>
    </div>
  )
})
