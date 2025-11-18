import { Route } from "effect-start"
import { DataService } from "../../Data.ts"

export default Route.html(function*() {
  const data = yield* DataService

  return (
    <div>
      <h1>People</h1>
      <div style="display: grid; gap: 20px;">
        {data.people.map((person) => (
          <div key={person.id} style="border: 1px solid #ccc; padding: 15px; border-radius: 8px;">
            <h2>
              <a href={`/people/${person.id}`}>{person.name}</a>
            </h2>
            <p><strong>Birth Year:</strong> {person.birthYear}</p>
            <p><strong>Nationality:</strong> {person.nationality}</p>
            <p><strong>Occupation:</strong> {person.occupation.join(", ")}</p>
            <p><strong>Known For:</strong> {person.knownFor.join(", ")}</p>
          </div>
        ))}
      </div>
    </div>
  )
})
