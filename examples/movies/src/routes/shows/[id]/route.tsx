import * as Effect from "effect/Effect"
import * as FileSystem from "@effect/platform/FileSystem"
import * as Path from "@effect/platform/Path"
import * as Schema from "effect/Schema"
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

interface Person {
  id: number
  name: string
  role: string
  birthYear: number
}

const ParamsSchema = Schema.Struct({
  id: Schema.NumberFromString,
})

const loadShowById = (id: number) =>
  Effect.gen(function*() {
    const fs = yield* FileSystem.FileSystem
    const path = yield* Path.Path

    const dataPath = yield* path.join("examples/movies/data/shows.json")
    const content = yield* fs.readFileString(dataPath)
    const shows = JSON.parse(content) as Show[]

    const show = shows.find((s) => s.id === id)
    if (!show) {
      return yield* Effect.fail(new Error(`Show not found: ${id}`))
    }

    return show
  })

const loadPeople = Effect.gen(function*() {
  const fs = yield* FileSystem.FileSystem
  const path = yield* Path.Path

  const dataPath = yield* path.join("examples/movies/data/people.json")
  const content = yield* fs.readFileString(dataPath)
  const people = JSON.parse(content) as Person[]

  return people
})

export default Route.schemaUrlParams(ParamsSchema)(
  Route.html(
    Effect.gen(function*() {
      const params = yield* Route.params
      const show = yield* loadShowById(params.id)
      const people = yield* loadPeople

      const cast = show.cast
        .map((personId) => people.find((p) => p.id === personId))
        .filter((p): p is Person => p !== undefined)

      return (
        <div>
          <h1>{show.title}</h1>
          <div style="margin: 20px 0;">
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
          </div>

          <h2>Summary</h2>
          <p>{show.summary}</p>

          <h2>Cast</h2>
          <ul>
            {cast.map((person) => (
              <li key={person.id}>
                <a href={`/people/${person.id}`}>
                  {person.name}
                </a>
                {" "}
                (Born {person.birthYear})
              </li>
            ))}
          </ul>

          <p>
            <a href="/shows">Back to Shows</a>
            {" | "}
            <a href="/">Home</a>
          </p>
        </div>
      )
    }),
  ),
)
