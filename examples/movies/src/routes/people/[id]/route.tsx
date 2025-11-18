import * as Effect from "effect/Effect"
import * as FileSystem from "@effect/platform/FileSystem"
import * as Path from "@effect/platform/Path"
import * as Schema from "effect/Schema"
import { Route } from "effect-start"

interface Person {
  id: number
  name: string
  role: string
  birthYear: number
}

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

const ParamsSchema = Schema.Struct({
  id: Schema.NumberFromString,
})

const loadPersonById = (id: number) =>
  Effect.gen(function*() {
    const fs = yield* FileSystem.FileSystem
    const path = yield* Path.Path

    const dataPath = yield* path.join("examples/movies/data/people.json")
    const content = yield* fs.readFileString(dataPath)
    const people = JSON.parse(content) as Person[]

    const person = people.find((p) => p.id === id)
    if (!person) {
      return yield* Effect.fail(new Error(`Person not found: ${id}`))
    }

    return person
  })

const loadShows = Effect.gen(function*() {
  const fs = yield* FileSystem.FileSystem
  const path = yield* Path.Path

  const dataPath = yield* path.join("examples/movies/data/shows.json")
  const content = yield* fs.readFileString(dataPath)
  const shows = JSON.parse(content) as Show[]

  return shows
})

export default Route.schemaUrlParams(ParamsSchema)(
  Route.html(
    Effect.gen(function*() {
      const params = yield* Route.params
      const person = yield* loadPersonById(params.id)
      const shows = yield* loadShows

      const appearsIn = shows.filter((show) => show.cast.includes(person.id))

      return (
        <div>
          <h1>{person.name}</h1>
          <div style="margin: 20px 0;">
            <p>
              <strong>Role:</strong> {person.role}
            </p>
            <p>
              <strong>Born:</strong> {person.birthYear}
            </p>
          </div>

          <h2>Appears In</h2>
          {appearsIn.length > 0
            ? (
              <ul>
                {appearsIn.map((show) => (
                  <li key={show.id}>
                    <a href={`/shows/${show.id}`}>{show.title}</a>
                    {" "}
                    ({show.year}
                    {show.endYear && ` - ${show.endYear}`})
                  </li>
                ))}
              </ul>
            )
            : <p>No shows found</p>}

          <p>
            <a href="/people">Back to People</a>
            {" | "}
            <a href="/">Home</a>
          </p>
        </div>
      )
    }),
  ),
)
