import * as Effect from "effect/Effect"
import * as Option from "effect/Option"
import { Route } from "effect-start"
import * as SignedUser from "../services/SignedUser.ts"

export default Route.html(function*() {
  const userOption = yield* SignedUser.middleware

  return (
    <div>
      <h1>Movies Database</h1>

      <nav>
        <ul>
          <li><a href="/movies">Movies</a></li>
          <li><a href="/shows">TV Shows</a></li>
          <li><a href="/people">People</a></li>
        </ul>
      </nav>

      {Option.isSome(userOption) ? (
        <div className="user-info">
          <p>Logged in as: <strong>{userOption.value.name}</strong> ({userOption.value.email})</p>
          <a href="/logout">Logout</a>
        </div>
      ) : (
        <div className="auth-links">
          <a href="/login">Login</a> | <a href="/register">Register</a>
        </div>
      )}

      <style>{`
        nav ul {
          list-style: none;
          padding: 0;
          display: flex;
          gap: 20px;
        }
        nav ul li {
          display: inline;
        }
        nav a {
          text-decoration: none;
          color: #007bff;
        }
        nav a:hover {
          text-decoration: underline;
        }
        .user-info, .auth-links {
          margin-top: 20px;
          padding: 10px;
          background-color: #f8f9fa;
          border-radius: 4px;
        }
      `}</style>
    </div>
  )
})
