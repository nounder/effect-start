import { Route } from "effect-start"
import * as Effect from "effect/Effect"
import * as FileSystem from "@effect/platform/FileSystem"
import * as Path from "@effect/platform/Path"

interface Movie {
  id: number
  title: string
  type: string
  year: number
  rating: number
  runtime: number
  genres: string[]
  director: string
  plot: string
}

export default Route.html(function*() {
  const fs = yield* FileSystem.FileSystem
  const path = yield* Path.Path

  const dataPath = path.join(import.meta.dir, "../../data/shows.json")
  const content = yield* fs.readFileString(dataPath)
  const shows: Movie[] = JSON.parse(content)

  const movies = shows.filter(show => show.type === "movie")

  return (
    <div>
      <h1>Movies</h1>
      <div className="movies-grid">
        {movies.map(movie => (
          <div key={movie.id} className="movie-card">
            <h2>
              <a href={`/movies/${movie.id}`}>{movie.title}</a>
            </h2>
            <p><strong>Year:</strong> {movie.year} | <strong>Rating:</strong> {movie.rating}/10 | <strong>Runtime:</strong> {movie.runtime} min</p>
            <p><strong>Director:</strong> {movie.director}</p>
            <p><strong>Genres:</strong> {movie.genres.join(", ")}</p>
            <p>{movie.plot}</p>
          </div>
        ))}
      </div>
      <style>{`
        .movies-grid {
          display: grid;
          gap: 20px;
        }
        .movie-card {
          border: 1px solid #ccc;
          padding: 15px;
          border-radius: 8px;
        }
      `}</style>
    </div>
  )
})
