import { Route } from "effect-start"
import shows from "../../data/shows.json" with { type: "json" }

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
