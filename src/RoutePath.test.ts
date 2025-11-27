import * as t from "bun:test"
import * as RoutePath from "./RoutePath.ts"

t.describe(`${RoutePath.toColon.name}`, () => {
  t.test("literal path unchanged", () => {
    t.expect(RoutePath.toColon("/")).toEqual(["/"])
    t.expect(RoutePath.toColon("/about")).toEqual(["/about"])
    t.expect(RoutePath.toColon("/users/profile")).toEqual([
      "/users/profile",
    ])
  })

  t.test("param [param] -> :param", () => {
    t.expect(RoutePath.toColon("/users/[id]")).toEqual(["/users/:id"])
    t.expect(RoutePath.toColon("/[category]/[product]")).toEqual([
      "/:category/:product",
    ])
  })

  t.test("optional param [[param]] -> :param?", () => {
    t.expect(RoutePath.toColon("/users/[[id]]")).toEqual([
      "/users/:id?",
    ])
    t.expect(RoutePath.toColon("/[[lang]]/about")).toEqual([
      "/:lang?/about",
    ])
  })

  t.test("rest [...param] -> *", () => {
    t.expect(RoutePath.toColon("/docs/[...path]")).toEqual(["/docs/*"])
    t.expect(RoutePath.toColon("/files/[...rest]")).toEqual([
      "/files/*",
    ])
  })

  t.test("optional rest [[...param]] -> two routes", () => {
    t.expect(RoutePath.toColon("/[[...frontend]]")).toEqual([
      "/",
      "/*",
    ])
    t.expect(RoutePath.toColon("/app/[[...slug]]")).toEqual([
      "/app",
      "/app/*",
    ])
    t.expect(RoutePath.toColon("/docs/[[...path]]")).toEqual([
      "/docs",
      "/docs/*",
    ])
  })

  t.test("param with prefix pk_[id] -> pk_:id", () => {
    t.expect(RoutePath.toColon("/keys/pk_[id]")).toEqual([
      "/keys/pk_:id",
    ])
    t.expect(RoutePath.toColon("/sk_[key]")).toEqual(["/sk_:key"])
  })

  t.test("param with suffix [name].json -> :name.json", () => {
    t.expect(RoutePath.toColon("/api/[id].json")).toEqual([
      "/api/:id.json",
    ])
  })

  t.test("param with prefix and suffix", () => {
    t.expect(RoutePath.toColon("/files/file_[id].txt")).toEqual([
      "/files/file_:id.txt",
    ])
  })

  t.test("toHono and toBun are aliases", () => {
    t.expect(RoutePath.toHono).toBe(RoutePath.toColon)
    t.expect(RoutePath.toBun).toBe(RoutePath.toColon)
  })
})

t.describe(`${RoutePath.toExpress.name}`, () => {
  t.test("literal path unchanged", () => {
    t.expect(RoutePath.toExpress("/")).toEqual(["/"])
    t.expect(RoutePath.toExpress("/about")).toEqual(["/about"])
  })

  t.test("param [param] -> :param", () => {
    t.expect(RoutePath.toExpress("/users/[id]")).toEqual([
      "/users/:id",
    ])
  })

  t.test("optional param [[param]] -> {/:param}", () => {
    t.expect(RoutePath.toExpress("/users/[[id]]")).toEqual([
      "/users{/:id}",
    ])
    t.expect(RoutePath.toExpress("/[[lang]]/about")).toEqual([
      "/{/:lang}/about",
    ])
  })

  t.test("rest [...param] -> /*param", () => {
    t.expect(RoutePath.toExpress("/docs/[...path]")).toEqual([
      "/docs/*path",
    ])
    t.expect(RoutePath.toExpress("/files/[...rest]")).toEqual([
      "/files/*rest",
    ])
  })

  t.test("optional rest [[...param]] -> two routes", () => {
    t.expect(RoutePath.toExpress("/[[...frontend]]")).toEqual([
      "/",
      "/*frontend",
    ])
    t.expect(RoutePath.toExpress("/app/[[...slug]]")).toEqual([
      "/app",
      "/app/*slug",
    ])
  })

  t.test("param with prefix pk_[id] -> pk_:id", () => {
    t.expect(RoutePath.toExpress("/keys/pk_[id]")).toEqual([
      "/keys/pk_:id",
    ])
  })
})

t.describe(`${RoutePath.toEffect.name}`, () => {
  t.test("literal path unchanged", () => {
    t.expect(RoutePath.toEffect("/")).toEqual(["/"])
    t.expect(RoutePath.toEffect("/about")).toEqual([
      "/about",
    ])
  })

  t.test("param [param] -> :param", () => {
    t.expect(RoutePath.toEffect("/users/[id]")).toEqual([
      "/users/:id",
    ])
  })

  t.test("optional param [[param]] -> :param?", () => {
    t.expect(RoutePath.toEffect("/users/[[id]]")).toEqual([
      "/users/:id?",
    ])
  })

  t.test("rest [...param] -> *", () => {
    t.expect(RoutePath.toEffect("/docs/[...path]")).toEqual(
      [
        "/docs/*",
      ],
    )
  })

  t.test("optional rest [[...param]] -> two routes", () => {
    t
      .expect(RoutePath.toEffect("/[[...frontend]]"))
      .toEqual(
        ["/", "/*"],
      )
    t
      .expect(RoutePath.toEffect("/app/[[...slug]]"))
      .toEqual(
        ["/app", "/app/*"],
      )
  })

  t.test("param with prefix pk_[id] -> pk_:id", () => {
    t.expect(RoutePath.toEffect("/keys/pk_[id]")).toEqual([
      "/keys/pk_:id",
    ])
  })
})

t.describe(`${RoutePath.toURLPattern.name}`, () => {
  t.test("literal path unchanged", () => {
    t.expect(RoutePath.toURLPattern("/")).toEqual(["/"])
    t.expect(RoutePath.toURLPattern("/about")).toEqual(["/about"])
  })

  t.test("param [param] -> :param", () => {
    t.expect(RoutePath.toURLPattern("/users/[id]")).toEqual([
      "/users/:id",
    ])
  })

  t.test("optional param [[param]] -> :param?", () => {
    t.expect(RoutePath.toURLPattern("/users/[[id]]")).toEqual([
      "/users/:id?",
    ])
  })

  t.test("rest [...param] -> :param+", () => {
    t.expect(RoutePath.toURLPattern("/docs/[...path]")).toEqual([
      "/docs/:path+",
    ])
  })

  t.test("optional rest [[...param]] -> :param*", () => {
    t.expect(RoutePath.toURLPattern("/[[...frontend]]")).toEqual([
      "/:frontend*",
    ])
    t.expect(RoutePath.toURLPattern("/app/[[...slug]]")).toEqual([
      "/app/:slug*",
    ])
  })

  t.test("param with prefix pk_[id] -> pk_:id", () => {
    t.expect(RoutePath.toURLPattern("/keys/pk_[id]")).toEqual([
      "/keys/pk_:id",
    ])
  })
})

t.describe(`${RoutePath.toRemix.name}`, () => {
  t.test("literal path unchanged", () => {
    t.expect(RoutePath.toRemix("/")).toEqual(["/"])
    t.expect(RoutePath.toRemix("/about")).toEqual(["/about"])
  })

  t.test("param [param] -> $param", () => {
    t.expect(RoutePath.toRemix("/users/[id]")).toEqual([
      "/users/$id",
    ])
  })

  t.test("optional param [[param]] -> ($param)", () => {
    t.expect(RoutePath.toRemix("/users/[[id]]")).toEqual([
      "/users/($id)",
    ])
  })

  t.test("rest [...param] -> $", () => {
    t.expect(RoutePath.toRemix("/docs/[...path]")).toEqual([
      "/docs/$",
    ])
  })

  t.test("optional rest [[...param]] -> two routes", () => {
    t.expect(RoutePath.toRemix("/[[...frontend]]")).toEqual([
      "/",
      "$",
    ])
    t.expect(RoutePath.toRemix("/app/[[...slug]]")).toEqual([
      "/app",
      "/app/$",
    ])
  })

  t.test("param with prefix pk_[id] -> pk_$id (not officially supported)", () => {
    t.expect(RoutePath.toRemix("/keys/pk_[id]")).toEqual([
      "/keys/pk_$id",
    ])
  })
})
