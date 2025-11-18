import { Route } from "effect-start"
import { DataService } from "../../Data.ts"

export default Route.html(function*() {
  const data = yield* DataService

  return (
    <div>
      <h1>TV Shows</h1>
      <div style="display: grid; gap: 20px;">
        {data.shows.map((show) => (
          <div key={show.id} style="border: 1px solid #ccc; padding: 15px; border-radius: 8px;">
            <h2>
              <a href={`/shows/${show.id}`}>{show.title}</a>
            </h2>
            <p><strong>Years:</strong> {show.years}</p>
            <p><strong>Seasons:</strong> {show.seasons}</p>
            <p><strong>Creator:</strong> {show.creator}</p>
            <p><strong>Genre:</strong> {show.genre.join(", ")}</p>
            <p><strong>Rating:</strong> {show.rating}/10</p>
            <p><strong>Cast:</strong> {show.cast.join(", ")}</p>
            <p>{show.plot}</p>
          </div>
        ))}
      </div>
    </div>
  )
})
