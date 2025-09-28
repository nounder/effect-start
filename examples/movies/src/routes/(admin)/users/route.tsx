import * as Db from "db"
import {
  html,
  Route,
} from "effect-start"

export default Route.page(function*() {
  const users = yield* Db.use(db =>
    db
      .from(db.User)
      .order(db.desc(db.User.email))
  )

  html`
<div>
  <h1>Users</h1>
  <table>
    ${
    users.map(user =>
      html`
<tr>
  <td>
    {user.name}
  </td>
</tr>
        `
    )
  }
  </table>
</div>
`

  return (
    <div>
      <h1>
        Users
      </h1>

      <table>
        {}
      </table>
    </div>
  )
})
