import { Route } from "effect-start"
import * as Effect from "effect/Effect"
import * as FileSystem from "@effect/platform/FileSystem"
import * as Path from "@effect/platform/Path"

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
  const fs = yield* FileSystem.FileSystem
  const path = yield* Path.Path

  const id = parseInt(ctx.params.id)

  const showsPath = path.join(import.meta.dir, "../../../data/shows.json")
  const peoplePath = path.join(import.meta.dir, "../../../data/people.json")

  const showsContent = yield* fs.readFileString(showsPath)
  const peopleContent = yield* fs.readFileString(peoplePath)

  const shows: Show[] = JSON.parse(showsContent)
  const people: Person[] = JSON.parse(peopleContent)

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

      <div class="show-details">
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
