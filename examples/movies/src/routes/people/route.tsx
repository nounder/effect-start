import { Route } from "effect-start"
import * as Effect from "effect/Effect"
import * as FileSystem from "@effect/platform/FileSystem"
import * as Path from "@effect/platform/Path"

interface Person {
  id: number
  name: string
  birthYear: number
  roles: string[]
}

export default Route.html(function*() {
  const fs = yield* FileSystem.FileSystem
  const path = yield* Path.Path

  const dataPath = path.join(import.meta.dir, "../../data/people.json")
  const content = yield* fs.readFileString(dataPath)
  const people: Person[] = JSON.parse(content)

  return (
    <div>
      <h1>People</h1>
      <div class="people-grid">
        {people.map(person => (
          <div key={person.id} class="person-card">
            <h2>
              <a href={`/people/${person.id}`}>{person.name}</a>
            </h2>
            <p><strong>Born:</strong> {person.birthYear}</p>
            <p><strong>Roles:</strong> {person.roles.join(", ")}</p>
          </div>
        ))}
      </div>
      <style>{`
        .people-grid {
          display: grid;
          gap: 15px;
        }
        .person-card {
          border: 1px solid #ccc;
          padding: 15px;
          border-radius: 8px;
        }
      `}</style>
    </div>
  )
})
