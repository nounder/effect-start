import * as Effect from "effect/Effect"
import * as FileSystem from "@effect/platform/FileSystem"
import * as Path from "@effect/platform/Path"
import { Route } from "effect-start"

interface Person {
  id: number
  name: string
  role: string
  birthYear: number
}

const loadPeople = Effect.gen(function*() {
  const fs = yield* FileSystem.FileSystem
  const path = yield* Path.Path

  const dataPath = yield* path.join("examples/movies/data/people.json")
  const content = yield* fs.readFileString(dataPath)
  const people = JSON.parse(content) as Person[]

  return people
})

export default Route.html(
  Effect.gen(function*() {
    const people = yield* loadPeople

    return (
      <div>
        <h1>People</h1>
        <div style="display: grid; gap: 15px;">
          {people.map((person) => (
            <div
              key={person.id}
              style="border: 1px solid #ccc; padding: 10px; border-radius: 5px;"
            >
              <h3>
                <a href={`/people/${person.id}`}>{person.name}</a>
              </h3>
              <p>
                <strong>Role:</strong> {person.role}
              </p>
              <p>
                <strong>Born:</strong> {person.birthYear}
              </p>
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
