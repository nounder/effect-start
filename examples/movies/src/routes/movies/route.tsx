import { Route } from "effect-start"
import { DataService } from "../../Data.ts"

export default Route.html(function*() {
  const data = yield* DataService

  return (
    <div>
      <h1>Movies</h1>
      <div style="display: grid; gap: 20px;">
        {data.movies.map((movie) => (
          <div key={movie.id} style="border: 1px solid #ccc; padding: 15px; border-radius: 8px;">
            <h2>
              <a href={`/movies/${movie.id}`}>{movie.title}</a> ({movie.year})
            </h2>
            <p><strong>Director:</strong> {movie.director}</p>
            <p><strong>Genre:</strong> {movie.genre.join(", ")}</p>
            <p><strong>Rating:</strong> {movie.rating}/10</p>
            <p><strong>Cast:</strong> {movie.cast.join(", ")}</p>
            <p>{movie.plot}</p>
          </div>
        ))}
      </div>
    </div>
  )
})
