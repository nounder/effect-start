import { Route } from "effect-start"
import shows from "../../../data/shows.json" with { type: "json" }
import people from "../../../data/people.json" with { type: "json" }

interface Show {
  id: number
  title: string
  type: string
  year: number
  endYear?: number
  rating: number
  runtime?: number
  seasons?: number
  episodes?: number
  genres: string[]
  director?: string
  creator?: string
  cast: number[]
  plot: string
}

interface Person {
  id: number
  name: string
  birthYear: number
  roles: string[]
}

export default Route.html(function*(ctx) {
  const id = parseInt(ctx.params.id)

  const show = shows.find(s => s.id === id)

  if (!show) {
    return (
      <div>
        <h1>Show not found</h1>
        <p><a href="/movies">Back to movies</a></p>
      </div>
    )
  }

  const cast = show.cast.map(personId => people.find(p => p.id === personId)).filter(Boolean)

  return (
    <div>
      <h1>{show.title}</h1>
      <p><a href={show.type === "movie" ? "/movies" : "/shows"}>Back to {show.type === "movie" ? "movies" : "shows"}</a></p>

      <div className="show-details">
        <p><strong>Type:</strong> {show.type === "movie" ? "Movie" : "TV Show"}</p>
        <p><strong>Year:</strong> {show.year}{show.endYear ? ` - ${show.endYear}` : ""}</p>
        <p><strong>Rating:</strong> {show.rating}/10</p>

        {show.runtime && <p><strong>Runtime:</strong> {show.runtime} minutes</p>}
        {show.seasons && <p><strong>Seasons:</strong> {show.seasons} ({show.episodes} episodes)</p>}

        {show.director && <p><strong>Director:</strong> {show.director}</p>}
        {show.creator && <p><strong>Creator:</strong> {show.creator}</p>}

        <p><strong>Genres:</strong> {show.genres.join(", ")}</p>

        <h3>Plot</h3>
        <p>{show.plot}</p>

        <h3>Cast</h3>
        <ul>
          {cast.map(person => (
            <li key={person!.id}>
              <a href={`/people/${person!.id}`}>{person!.name}</a> (born {person!.birthYear})
            </li>
          ))}
        </ul>
      </div>
      <style>{`
        .show-details {
          margin-top: 20px;
        }
      `}</style>
    </div>
  )
})
