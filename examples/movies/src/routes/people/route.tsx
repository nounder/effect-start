import { Route } from "effect-start"
import people from "../../data/people.json" with { type: "json" }

interface Person {
  id: number
  name: string
  birthYear: number
  roles: string[]
}

export default Route.html(function*() {

  return (
    <div>
      <h1>People</h1>
      <div className="people-grid">
        {people.map(person => (
          <div key={person.id} className="person-card">
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
