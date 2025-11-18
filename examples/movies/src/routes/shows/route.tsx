import * as Effect from "effect/Effect"
import * as FileSystem from "@effect/platform/FileSystem"
import * as Path from "@effect/platform/Path"
import { Route } from "effect-start"

interface Show {
  id: number
  title: string
  year: number
  endYear: number | null
  rating: number
  genres: string[]
  summary: string
  network: string
  status: string
  cast: number[]
}

const loadShows = Effect.gen(function*() {
  const fs = yield* FileSystem.FileSystem
  const path = yield* Path.Path

  const dataPath = yield* path.join("examples/movies/data/shows.json")
  const content = yield* fs.readFileString(dataPath)
  const shows = JSON.parse(content) as Show[]

  return shows
})

export default Route.html(
  Effect.gen(function*() {
    const shows = yield* loadShows

    return (
      <div>
        <h1>TV Shows</h1>
        <div style="display: grid; gap: 20px;">
          {shows.map((show) => (
            <div
              key={show.id}
              style="border: 1px solid #ccc; padding: 15px; border-radius: 8px;"
            >
              <h2>
                <a href={`/shows/${show.id}`}>{show.title}</a>
              </h2>
              <p>
                <strong>Year:</strong> {show.year}
                {show.endYear && ` - ${show.endYear}`}
              </p>
              <p>
                <strong>Rating:</strong> {show.rating}/10
              </p>
              <p>
                <strong>Network:</strong> {show.network}
              </p>
              <p>
                <strong>Status:</strong> {show.status}
              </p>
              <p>
                <strong>Genres:</strong> {show.genres.join(", ")}
              </p>
              <p>{show.summary}</p>
            </div>
          ))}
        </div>
        <p>
          <a href="/">Back to Home</a>
        </p>
      </div>
    )
  }),
)
