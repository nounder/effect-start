import * as test from "bun:test"
import * as Cause from "effect/Cause"
import * as Effect from "effect/Effect"
import * as Exit from "effect/Exit"
import * as Option from "effect/Option"
import * as FileRouter from "./FileRouter.ts"
import * as Route from "./Route.ts"
import * as RouteTree from "./RouteTree.ts"
import * as TestLogger from "./testing/TestLogger.ts"

test.it("fails on overlapping routes from groups", async () => {
  const routes = ["(admin)/users/route.tsx", "users/route.tsx"]
    .map(FileRouter.parseRoute)
    .filter((h): h is FileRouter.FileRoute => h !== null)

  const exit = await FileRouter.getFileRoutes(routes.map((h) => h.modulePath)).pipe(
    Effect.runPromiseExit,
  )

  test.expect(Exit.isFailure(exit)).toBe(true)

  if (Exit.isFailure(exit)) {
    const error = Option.getOrThrow(Cause.failureOption(exit.cause))

    test.expect(error.reason).toBe("Conflict")
    test.expect(error.path).toBe("/users")
  }
})

test.it("fails on overlapping routes with same path", async () => {
  const routes = ["about/route.tsx", "about/route.ts"]
    .map(FileRouter.parseRoute)
    .filter((h): h is FileRouter.FileRoute => h !== null)

  const exit = await FileRouter.getFileRoutes(routes.map((h) => h.modulePath)).pipe(
    Effect.runPromiseExit,
  )

  test.expect(Exit.isFailure(exit)).toBe(true)

  if (Exit.isFailure(exit)) {
    const error = Option.getOrThrow(Cause.failureOption(exit.cause))

    test.expect(error.reason).toBe("Conflict")
    test.expect(error.path).toBe("/about")
  }
})

test.it("allows route and layer at same path", async () => {
  const routes = ["users/route.tsx", "users/layer.tsx"]
    .map(FileRouter.parseRoute)
    .filter((h): h is FileRouter.FileRoute => h !== null)

  const exit = await FileRouter.getFileRoutes(routes.map((h) => h.modulePath)).pipe(
    Effect.runPromiseExit,
  )

  test.expect(Exit.isSuccess(exit)).toBe(true)
})

test.it("fromFileRoutes continues when a module fails to import", () =>
  Effect.gen(function* () {
    const goodRoute = Route.get(Route.text("ok"))

    const fileRoutes: FileRouter.FileRoutes = {
      "/good": [() => Promise.resolve({ default: goodRoute })],
      "/bad": [
        () => {
          throw new Error("Cannot find module './missing.ts'")
        },
      ],
    }

    const tree = yield* FileRouter.fromFileRoutes(fileRoutes)
    const routes = [...RouteTree.walk(tree)]

    test.expect(routes.length).toBeGreaterThan(0)

    const paths = routes.map((r) => Route.descriptor(r).path)
    test.expect(paths).toContain("/good")

    const messages = yield* TestLogger.messages
    test.expect(messages.some((m) => m.includes("Failed to import route module"))).toBe(true)
  }).pipe(Effect.provide(TestLogger.layer()), Effect.runPromise),
)
