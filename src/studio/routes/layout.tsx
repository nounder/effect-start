import * as Effect from "effect/Effect"
import * as BunRoute from "../../bun/BunRoute.ts"
import * as Entity from "../../Entity.ts"
import * as Route from "../../Route.ts"
import * as Studio from "../Studio.ts"
import * as StudioStore from "../StudioStore.ts"

const unauthorized = Entity.make("Unauthorized", {
  status: 401,
  headers: {
    "www-authenticate": 'Basic realm="Studio", charset="UTF-8"',
    "content-type": "text/plain; charset=utf-8",
  },
})

const basicAuthRoute = Route.make<{}, {}, unknown, never, Studio.Studio | Route.Request>(
  (context, next) =>
    Effect.gen(function* () {
      const studio = yield* Studio.Studio
      if (!studio.auth || studio.auth.type !== "basic") return yield* next(context)
      const request = yield* Route.Request
      const header = request.headers.get("authorization")
      const expected = "Basic " + btoa(`${studio.auth.username}:${studio.auth.password}`)
      if (header !== expected) return unauthorized
      return yield* next(context)
    }),
)

export default Route.use(
  (self) => Route.set([...Route.items(self), basicAuthRoute], Route.descriptor(self)),
  Route.filter(function* () {
    yield* Effect.annotateCurrentSpan(StudioStore.studioTraceAttribute, true)
    return { context: {} }
  }),
  BunRoute.htmlBundle(() => import("./layout.html")),
)
