import { Console, Data, Effect, Layer, pipe, Stream } from "effect"
import { FileRouter } from "effect-bundler"
import { watchFileChanges } from "effect-bundler/files"

const RoutesDir = import.meta.dir + "/routes"

export class TanstackRouterError
  extends Data.TaggedError("TanstackRouterError")<{
    message: string
    cause?: unknown
  }>
{}

export function generateRouteTree(root: string = RoutesDir) {
  return Effect.gen(function*() {
    // Walk the routes directory to get all route files
    const files = yield* FileRouter.walkRoutes(root)
  })
}

export function layer() {
  const root = process.cwd()

  return Layer.scopedDiscard(
    Effect.gen(function*() {
      yield* pipe(
        watchFileChanges(root),
        Stream.runForEach(Console.log),
      )
    }),
  )
}
