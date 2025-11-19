import { Route } from "effect-start"
import people from "../../../data/people.json" with { type: "json" }
import shows from "../../../data/shows.json" with { type: "json" }

interface Person {
  id: number
  name: string
  birthYear: number
  roles: string[]
}

interface Show {
  id: number
  title: string
  type: string
  year: number
  cast: number[]
}

export default Route.html(function*(ctx) {
  const id = parseInt(ctx.params.id)

  const person = people.find(p => p.id === id)

  if (!person) {
    return (
      <div>
        <h1>Person not found</h1>
        <p><a href="/people">Back to people</a></p>
      </div>
    )
  }

  const credits = shows.filter(show => show.cast.includes(id))

  return (
    <div>
      <h1>{person.name}</h1>
      <p><a href="/people">Back to people</a></p>

      <div className="person-details">
        <p><strong>Born:</strong> {person.birthYear} (age {new Date().getFullYear() - person.birthYear})</p>
        <p><strong>Roles:</strong> {person.roles.join(", ")}</p>

        <h3>Credits</h3>
        {credits.length > 0 ? (
          <ul>
            {credits.map(show => (
              <li key={show.id}>
                <a href={`/movies/${show.id}`}>{show.title}</a> ({show.year}) - {show.type}
              </li>
            ))}
          </ul>
        ) : (
          <p>No credits found.</p>
        )}
      </div>
      <style>{`
        .person-details {
          margin-top: 20px;
        }
      `}</style>
    </div>
  )
})
