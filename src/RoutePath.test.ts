import * as t from "bun:test"
import { Types } from "effect"
import * as RoutePath from "./RoutePath.ts"

type Assert<_T extends true> = void

t.describe("Segments", () => {
  t.test("literal path", () => {
    type _1 = Assert<Types.Equals<RoutePath.Segments<"/">, []>>
    type _2 = Assert<
      Types.Equals<RoutePath.Segments<"/about">, [RoutePath.Literal<"about">]>
    >
    type _3 = Assert<
      Types.Equals<
        RoutePath.Segments<"/users/profile">,
        [RoutePath.Literal<"users">, RoutePath.Literal<"profile">]
      >
    >
  })

  t.test("simple param [param]", () => {
    type _1 = Assert<
      Types.Equals<
        RoutePath.Segments<"/users/[id]">,
        [RoutePath.Literal<"users">, RoutePath.Param<"id", false>]
      >
    >
    type _2 = Assert<
      Types.Equals<
        RoutePath.Segments<"/[category]/[product]">,
        [RoutePath.Param<"category", false>, RoutePath.Param<"product", false>]
      >
    >
  })

  t.test("optional param [[param]]", () => {
    type _ = Assert<
      Types.Equals<
        RoutePath.Segments<"/users/[[id]]">,
        [RoutePath.Literal<"users">, RoutePath.Param<"id", true>]
      >
    >
  })

  t.test("rest param [...param]", () => {
    type _ = Assert<
      Types.Equals<
        RoutePath.Segments<"/docs/[...path]">,
        [RoutePath.Literal<"docs">, RoutePath.Rest<"path", false>]
      >
    >
  })

  t.test("optional rest param [[...param]]", () => {
    type _1 = Assert<
      Types.Equals<
        RoutePath.Segments<"/[[...frontend]]">,
        [RoutePath.Rest<"frontend", true>]
      >
    >
    type _2 = Assert<
      Types.Equals<
        RoutePath.Segments<"/app/[[...slug]]">,
        [RoutePath.Literal<"app">, RoutePath.Rest<"slug", true>]
      >
    >
  })

  t.test("param with prefix pk_[id]", () => {
    type _ = Assert<
      Types.Equals<
        RoutePath.Segments<"/keys/pk_[id]">,
        [RoutePath.Literal<"keys">, RoutePath.Param<"id", false, "pk_">]
      >
    >
  })

  t.test("param with suffix [id].json", () => {
    type _ = Assert<
      Types.Equals<
        RoutePath.Segments<"/api/[id].json">,
        [RoutePath.Literal<"api">, RoutePath.Param<"id", false, "", ".json">]
      >
    >
  })

  t.test("param with prefix and suffix file_[id].txt", () => {
    type _ = Assert<
      Types.Equals<
        RoutePath.Segments<"/files/file_[id].txt">,
        [
          RoutePath.Literal<"files">,
          RoutePath.Param<"id", false, "file_", ".txt">,
        ]
      >
    >
  })

  t.test("param with prefix and suffix prefix_[id]_suffix", () => {
    type _ = Assert<
      Types.Equals<
        RoutePath.Segments<"/prefix_[id]_suffix">,
        [RoutePath.Param<"id", false, "prefix_", "_suffix">]
      >
    >
  })

  t.test("malformed segment pk_[id]foo → undefined (suffix without delimiter)", () => {
    type _ = Assert<
      Types.Equals<RoutePath.Segments<"/pk_[id]foo">, [undefined]>
    >
  })

  t.test("no delimiter prefix/suffix → Literal", () => {
    type _ = Assert<
      Types.Equals<
        RoutePath.Segments<"/pk[id]foo">,
        [RoutePath.Literal<"pk[id]foo">]
      >
    >
  })
})

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
