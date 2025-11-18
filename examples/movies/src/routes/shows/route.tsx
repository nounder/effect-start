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
  seasons?: number
  episodes?: number
  genres: string[]
  creator?: string
  plot: string
}

export default Route.html(function*() {
  const fs = yield* FileSystem.FileSystem
  const path = yield* Path.Path

  const dataPath = path.join(import.meta.dir, "../../data/shows.json")
  const content = yield* fs.readFileString(dataPath)
  const allShows: Show[] = JSON.parse(content)

  const tvShows = allShows.filter(show => show.type === "tv")

  return (
    <div>
      <h1>TV Shows</h1>
      <div class="shows-grid">
        {tvShows.map(show => (
          <div key={show.id} class="show-card">
            <h2>
              <a href={`/movies/${show.id}`}>{show.title}</a>
            </h2>
            <p><strong>Year:</strong> {show.year}{show.endYear ? ` - ${show.endYear}` : ""} | <strong>Rating:</strong> {show.rating}/10</p>
            {show.seasons && <p><strong>Seasons:</strong> {show.seasons} ({show.episodes} episodes)</p>}
            {show.creator && <p><strong>Creator:</strong> {show.creator}</p>}
            <p><strong>Genres:</strong> {show.genres.join(", ")}</p>
            <p>{show.plot}</p>
          </div>
        ))}
      </div>
      <style>{`
        .shows-grid {
          display: grid;
          gap: 20px;
        }
        .show-card {
          border: 1px solid #ccc;
          padding: 15px;
          border-radius: 8px;
        }
      `}</style>
    </div>
  )
})
