import * as test from "bun:test"
import * as Result from "effect/Result"
import * as FileRouter from "effect-start/FileRouter"
import * as PathPattern from "effect-start/internal/PathPattern"

test.it("converts empty file paths", () => {
  test
    .expect(PathPattern.fromFilePath(""))
    .toEqual(Result.succeed("/"))
  test
    .expect(PathPattern.fromFilePath("/"))
    .toEqual(Result.succeed("/"))
})

test.it("strips groups during conversion", () => {
  test
    .expect(PathPattern.fromFilePath("(admin)"))
    .toEqual(Result.succeed("/"))
  test
    .expect(PathPattern.fromFilePath("/(admin)/users"))
    .toEqual(
      Result.succeed("/users"),
    )
  test
    .expect(PathPattern.fromFilePath("(auth)/login/(step1)"))
    .toEqual(
      Result.succeed("/login"),
    )
})

test.it("converts params and rest segments", () => {
  test
    .expect(PathPattern.fromFilePath("users/[userId]/posts"))
    .toEqual(Result.succeed("/users/:userId/posts"))
  test
    .expect(PathPattern.fromFilePath("api/[[path]]"))
    .toEqual(
      Result.succeed("/api/:path*"),
    )
})

test.it("parseRoute extracts handle", () => {
  const route = FileRouter.parseRoute("users/route.tsx")

  test
    .expect(route)
    .not
    .toBeNull()
  test
    .expect(route!.handle)
    .toBe("route")
  test
    .expect(route!.routePath)
    .toBe("/users")

  const layer = FileRouter.parseRoute("api/layer.ts")

  test
    .expect(layer)
    .not
    .toBeNull()
  test
    .expect(layer!.handle)
    .toBe("layer")
  test
    .expect(layer!.routePath)
    .toBe("/api")
})

test.it("parseRoute with groups", () => {
  const route = FileRouter.parseRoute("(admin)/users/route.tsx")

  test
    .expect(route)
    .not
    .toBeNull()
  test
    .expect(route!.handle)
    .toBe("route")
  test
    .expect(route!.routePath)
    .toBe("/users")
})

test.it("parseRoute with params and rest", () => {
  const route = FileRouter.parseRoute("users/[userId]/posts/route.tsx")

  test
    .expect(route)
    .not
    .toBeNull()
  test
    .expect(route!.handle)
    .toBe("route")
  test
    .expect(route!.routePath)
    .toBe("/users/:userId/posts")

  const rest = FileRouter.parseRoute("api/[[path]]/route.ts")

  test
    .expect(rest)
    .not
    .toBeNull()
  test
    .expect(rest!.handle)
    .toBe("route")
  test
    .expect(rest!.routePath)
    .toBe("/api/:path*")
})

test.it("rejects invalid file path patterns", () => {
  test
    .expect(Result.isFailure(PathPattern.fromFilePath("$...")))
    .toBe(true)
  test
    .expect(Result.isFailure(PathPattern.fromFilePath("invalid%char")))
    .toBe(
      true,
    )
  test
    .expect(Result.isFailure(PathPattern.fromFilePath("foo/[[rest]]/bar")))
    .toBe(
      true,
    )
})

test.it("supports literal segments with dots", () => {
  test
    .expect(PathPattern.fromFilePath("events.json"))
    .toEqual(
      Result.succeed("/events.json"),
    )
})
