import { Route } from "effect-start"
import * as Effect from "effect/Effect"
import { DataService } from "../../../Data.ts"

export default Route.html(function*(ctx) {
  const data = yield* DataService
  const id = parseInt(ctx.params.id as string, 10)
  const person = data.getPersonById(id)

  if (!person) {
    return yield* Effect.fail(
      Route.notFound({
        message: `Person with ID ${id} not found`,
      }),
    )
  }

  return (
    <div>
      <h1>{person.name}</h1>
      <p><strong>Birth Year:</strong> {person.birthYear}</p>
      <p><strong>Nationality:</strong> {person.nationality}</p>
      <p><strong>Occupation:</strong> {person.occupation.join(", ")}</p>
      <div style="margin-top: 20px;">
        <h2>Known For</h2>
        <ul>
          {person.knownFor.map((work) => (
            <li key={work}>{work}</li>
          ))}
        </ul>
      </div>
      <div style="margin-top: 20px;">
        <a href="/people">← Back to People</a>
      </div>
    </div>
  )
})
