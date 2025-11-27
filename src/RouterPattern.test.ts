import * as t from "bun:test"
import { Types } from "effect"
import * as RouterPattern from "./RouterPattern.ts"

type Assert<_T extends true> = void

t.describe("Segments", () => {
  t.test("literal path", () => {
    type _1 = Assert<Types.Equals<RouterPattern.Segments<"/">, []>>
    type _2 = Assert<
      Types.Equals<
        RouterPattern.Segments<"/about">,
        [RouterPattern.LiteralSegment<"about">]
      >
    >
    type _3 = Assert<
      Types.Equals<
        RouterPattern.Segments<"/users/profile">,
        [
          RouterPattern.LiteralSegment<"users">,
          RouterPattern.LiteralSegment<"profile">,
        ]
      >
    >
  })

  t.test("simple param [param]", () => {
    type _1 = Assert<
      Types.Equals<
        RouterPattern.Segments<"/users/[id]">,
        [
          RouterPattern.LiteralSegment<"users">,
          RouterPattern.ParamSegment<"id", false>,
        ]
      >
    >
    type _2 = Assert<
      Types.Equals<
        RouterPattern.Segments<"/[category]/[product]">,
        [
          RouterPattern.ParamSegment<"category", false>,
          RouterPattern.ParamSegment<"product", false>,
        ]
      >
    >
  })

  t.test("optional param [[param]]", () => {
    type _ = Assert<
      Types.Equals<
        RouterPattern.Segments<"/users/[[id]]">,
        [
          RouterPattern.LiteralSegment<"users">,
          RouterPattern.ParamSegment<"id", true>,
        ]
      >
    >
  })

  t.test("rest param [...param]", () => {
    type _ = Assert<
      Types.Equals<
        RouterPattern.Segments<"/docs/[...path]">,
        [
          RouterPattern.LiteralSegment<"docs">,
          RouterPattern.RestSegment<"path", false>,
        ]
      >
    >
  })

  t.test("optional rest param [[...param]]", () => {
    type _1 = Assert<
      Types.Equals<
        RouterPattern.Segments<"/[[...frontend]]">,
        [RouterPattern.RestSegment<"frontend", true>]
      >
    >
    type _2 = Assert<
      Types.Equals<
        RouterPattern.Segments<"/app/[[...slug]]">,
        [
          RouterPattern.LiteralSegment<"app">,
          RouterPattern.RestSegment<"slug", true>,
        ]
      >
    >
  })

  t.test("param with prefix pk_[id]", () => {
    type _ = Assert<
      Types.Equals<
        RouterPattern.Segments<"/keys/pk_[id]">,
        [
          RouterPattern.LiteralSegment<"keys">,
          RouterPattern.ParamSegment<"id", false, "pk_">,
        ]
      >
    >
  })

  t.test("param with suffix [id].json", () => {
    type _ = Assert<
      Types.Equals<
        RouterPattern.Segments<"/api/[id].json">,
        [
          RouterPattern.LiteralSegment<"api">,
          RouterPattern.ParamSegment<"id", false, "", ".json">,
        ]
      >
    >
  })

  t.test("param with prefix and suffix file_[id].txt", () => {
    type _ = Assert<
      Types.Equals<
        RouterPattern.Segments<"/files/file_[id].txt">,
        [
          RouterPattern.LiteralSegment<"files">,
          RouterPattern.ParamSegment<"id", false, "file_", ".txt">,
        ]
      >
    >
  })

  t.test("param with prefix and suffix prefix_[id]_suffix", () => {
    type _ = Assert<
      Types.Equals<
        RouterPattern.Segments<"/prefix_[id]_suffix">,
        [RouterPattern.ParamSegment<"id", false, "prefix_", "_suffix">]
      >
    >
  })

  t.test("malformed segment pk_[id]foo → undefined (suffix without delimiter)", () => {
    type _ = Assert<
      Types.Equals<RouterPattern.Segments<"/pk_[id]foo">, [undefined]>
    >
  })

  t.test("no delimiter prefix/suffix → Literal", () => {
    type _ = Assert<
      Types.Equals<
        RouterPattern.Segments<"/pk[id]foo">,
        [RouterPattern.LiteralSegment<"pk[id]foo">]
      >
    >
  })
})

t.describe(`${RouterPattern.toColon.name}`, () => {
  t.test("literal path unchanged", () => {
    t.expect(RouterPattern.toColon("/")).toEqual(["/"])
    t.expect(RouterPattern.toColon("/about")).toEqual(["/about"])
    t.expect(RouterPattern.toColon("/users/profile")).toEqual([
      "/users/profile",
    ])
  })

  t.test("param [param] -> :param", () => {
    t.expect(RouterPattern.toColon("/users/[id]")).toEqual(["/users/:id"])
    t.expect(RouterPattern.toColon("/[category]/[product]")).toEqual([
      "/:category/:product",
    ])
  })

  t.test("optional param [[param]] -> :param?", () => {
    t.expect(RouterPattern.toColon("/users/[[id]]")).toEqual([
      "/users/:id?",
    ])
    t.expect(RouterPattern.toColon("/[[lang]]/about")).toEqual([
      "/:lang?/about",
    ])
  })

  t.test("rest [...param] -> *", () => {
    t.expect(RouterPattern.toColon("/docs/[...path]")).toEqual(["/docs/*"])
    t.expect(RouterPattern.toColon("/files/[...rest]")).toEqual([
      "/files/*",
    ])
  })

  t.test("optional rest [[...param]] -> two routes", () => {
    t.expect(RouterPattern.toColon("/[[...frontend]]")).toEqual([
      "/",
      "/*",
    ])
    t.expect(RouterPattern.toColon("/app/[[...slug]]")).toEqual([
      "/app",
      "/app/*",
    ])
    t.expect(RouterPattern.toColon("/docs/[[...path]]")).toEqual([
      "/docs",
      "/docs/*",
    ])
  })

  t.test("param with prefix pk_[id] -> pk_:id", () => {
    t.expect(RouterPattern.toColon("/keys/pk_[id]")).toEqual([
      "/keys/pk_:id",
    ])
    t.expect(RouterPattern.toColon("/sk_[key]")).toEqual(["/sk_:key"])
  })

  t.test("param with suffix [name].json -> :name.json", () => {
    t.expect(RouterPattern.toColon("/api/[id].json")).toEqual([
      "/api/:id.json",
    ])
  })

  t.test("param with prefix and suffix", () => {
    t.expect(RouterPattern.toColon("/files/file_[id].txt")).toEqual([
      "/files/file_:id.txt",
    ])
  })

  t.test("toHono and toBun are aliases", () => {
    t.expect(RouterPattern.toHono).toBe(RouterPattern.toColon)
    t.expect(RouterPattern.toBun).toBe(RouterPattern.toColon)
  })
})

t.describe(`${RouterPattern.toExpress.name}`, () => {
  t.test("literal path unchanged", () => {
    t.expect(RouterPattern.toExpress("/")).toEqual(["/"])
    t.expect(RouterPattern.toExpress("/about")).toEqual(["/about"])
  })

  t.test("param [param] -> :param", () => {
    t.expect(RouterPattern.toExpress("/users/[id]")).toEqual([
      "/users/:id",
    ])
  })

  t.test("optional param [[param]] -> {/:param}", () => {
    t.expect(RouterPattern.toExpress("/users/[[id]]")).toEqual([
      "/users{/:id}",
    ])
    t.expect(RouterPattern.toExpress("/[[lang]]/about")).toEqual([
      "/{/:lang}/about",
    ])
  })

  t.test("rest [...param] -> /*param", () => {
    t.expect(RouterPattern.toExpress("/docs/[...path]")).toEqual([
      "/docs/*path",
    ])
    t.expect(RouterPattern.toExpress("/files/[...rest]")).toEqual([
      "/files/*rest",
    ])
  })

  t.test("optional rest [[...param]] -> two routes", () => {
    t.expect(RouterPattern.toExpress("/[[...frontend]]")).toEqual([
      "/",
      "/*frontend",
    ])
    t.expect(RouterPattern.toExpress("/app/[[...slug]]")).toEqual([
      "/app",
      "/app/*slug",
    ])
  })

  t.test("param with prefix pk_[id] -> pk_:id", () => {
    t.expect(RouterPattern.toExpress("/keys/pk_[id]")).toEqual([
      "/keys/pk_:id",
    ])
  })
})

t.describe(`${RouterPattern.toEffect.name}`, () => {
  t.test("literal path unchanged", () => {
    t.expect(RouterPattern.toEffect("/")).toEqual(["/"])
    t.expect(RouterPattern.toEffect("/about")).toEqual([
      "/about",
    ])
  })

  t.test("param [param] -> :param", () => {
    t.expect(RouterPattern.toEffect("/users/[id]")).toEqual([
      "/users/:id",
    ])
  })

  t.test("optional param [[param]] -> :param?", () => {
    t.expect(RouterPattern.toEffect("/users/[[id]]")).toEqual([
      "/users/:id?",
    ])
  })

  t.test("rest [...param] -> *", () => {
    t.expect(RouterPattern.toEffect("/docs/[...path]")).toEqual(
      [
        "/docs/*",
      ],
    )
  })

  t.test("optional rest [[...param]] -> two routes", () => {
    t
      .expect(RouterPattern.toEffect("/[[...frontend]]"))
      .toEqual(
        ["/", "/*"],
      )
    t
      .expect(RouterPattern.toEffect("/app/[[...slug]]"))
      .toEqual(
        ["/app", "/app/*"],
      )
  })

  t.test("param with prefix pk_[id] -> pk_:id", () => {
    t.expect(RouterPattern.toEffect("/keys/pk_[id]")).toEqual([
      "/keys/pk_:id",
    ])
  })
})

t.describe(`${RouterPattern.toURLPattern.name}`, () => {
  t.test("literal path unchanged", () => {
    t.expect(RouterPattern.toURLPattern("/")).toEqual(["/"])
    t.expect(RouterPattern.toURLPattern("/about")).toEqual(["/about"])
  })

  t.test("param [param] -> :param", () => {
    t.expect(RouterPattern.toURLPattern("/users/[id]")).toEqual([
      "/users/:id",
    ])
  })

  t.test("optional param [[param]] -> :param?", () => {
    t.expect(RouterPattern.toURLPattern("/users/[[id]]")).toEqual([
      "/users/:id?",
    ])
  })

  t.test("rest [...param] -> :param+", () => {
    t.expect(RouterPattern.toURLPattern("/docs/[...path]")).toEqual([
      "/docs/:path+",
    ])
  })

  t.test("optional rest [[...param]] -> :param*", () => {
    t.expect(RouterPattern.toURLPattern("/[[...frontend]]")).toEqual([
      "/:frontend*",
    ])
    t.expect(RouterPattern.toURLPattern("/app/[[...slug]]")).toEqual([
      "/app/:slug*",
    ])
  })

  t.test("param with prefix pk_[id] -> pk_:id", () => {
    t.expect(RouterPattern.toURLPattern("/keys/pk_[id]")).toEqual([
      "/keys/pk_:id",
    ])
  })
})

t.describe(`${RouterPattern.toRemix.name}`, () => {
  t.test("literal path unchanged", () => {
    t.expect(RouterPattern.toRemix("/")).toEqual(["/"])
    t.expect(RouterPattern.toRemix("/about")).toEqual(["/about"])
  })

  t.test("param [param] -> $param", () => {
    t.expect(RouterPattern.toRemix("/users/[id]")).toEqual([
      "/users/$id",
    ])
  })

  t.test("optional param [[param]] -> ($param)", () => {
    t.expect(RouterPattern.toRemix("/users/[[id]]")).toEqual([
      "/users/($id)",
    ])
  })

  t.test("rest [...param] -> $", () => {
    t.expect(RouterPattern.toRemix("/docs/[...path]")).toEqual([
      "/docs/$",
    ])
  })

  t.test("optional rest [[...param]] -> two routes", () => {
    t.expect(RouterPattern.toRemix("/[[...frontend]]")).toEqual([
      "/",
      "$",
    ])
    t.expect(RouterPattern.toRemix("/app/[[...slug]]")).toEqual([
      "/app",
      "/app/$",
    ])
  })

  t.test("param with prefix pk_[id] -> pk_$id (not officially supported)", () => {
    t.expect(RouterPattern.toRemix("/keys/pk_[id]")).toEqual([
      "/keys/pk_$id",
    ])
  })
})

t.describe(`${RouterPattern.format.name}`, () => {
  t.test("empty segments", () => {
    t.expect(RouterPattern.format([])).toBe("/")
  })

  t.test("literal segments", () => {
    t
      .expect(
        RouterPattern.format([{ _tag: "LiteralSegment", value: "users" }]),
      )
      .toBe(
        "/users",
      )
    t
      .expect(
        RouterPattern.format([
          { _tag: "LiteralSegment", value: "users" },
          { _tag: "LiteralSegment", value: "profile" },
        ]),
      )
      .toBe("/users/profile")
  })

  t.test("param segments", () => {
    t.expect(RouterPattern.format([{ _tag: "ParamSegment", name: "id" }])).toBe(
      "/[id]",
    )
    t
      .expect(
        RouterPattern.format([{
          _tag: "ParamSegment",
          name: "id",
          optional: true,
        }]),
      )
      .toBe("/[[id]]")
  })

  t.test("param with prefix/suffix", () => {
    t
      .expect(
        RouterPattern.format([{
          _tag: "ParamSegment",
          name: "id",
          prefix: "pk_",
        }]),
      )
      .toBe("/pk_[id]")
    t
      .expect(
        RouterPattern.format([{
          _tag: "ParamSegment",
          name: "id",
          suffix: ".json",
        }]),
      )
      .toBe("/[id].json")
    t
      .expect(
        RouterPattern.format([
          { _tag: "ParamSegment", name: "id", prefix: "file_", suffix: ".txt" },
        ]),
      )
      .toBe("/file_[id].txt")
  })

  t.test("rest segments", () => {
    t
      .expect(RouterPattern.format([{ _tag: "RestSegment", name: "path" }]))
      .toBe(
        "/[...path]",
      )
    t
      .expect(
        RouterPattern.format([{
          _tag: "RestSegment",
          name: "path",
          optional: true,
        }]),
      )
      .toBe("/[[...path]]")
  })

  t.test("mixed segments", () => {
    t
      .expect(
        RouterPattern.format([
          { _tag: "LiteralSegment", value: "users" },
          { _tag: "ParamSegment", name: "id" },
          { _tag: "LiteralSegment", value: "posts" },
        ]),
      )
      .toBe("/users/[id]/posts")
  })
})

t.describe("parseSegment", () => {
  t.test("parses literal segments", () => {
    t.expect(RouterPattern.parseSegment("users")).toEqual({
      _tag: "LiteralSegment",
      value: "users",
    })
  })

  t.test("parses param segments", () => {
    t.expect(RouterPattern.parseSegment("[id]")).toEqual({
      _tag: "ParamSegment",
      name: "id",
    })
  })

  t.test("parses optional param segments", () => {
    t.expect(RouterPattern.parseSegment("[[id]]")).toEqual({
      _tag: "ParamSegment",
      name: "id",
      optional: true,
    })
  })

  t.test("parses rest segments", () => {
    t.expect(RouterPattern.parseSegment("[...path]")).toEqual({
      _tag: "RestSegment",
      name: "path",
    })
  })

  t.test("parses optional rest segments", () => {
    t.expect(RouterPattern.parseSegment("[[...path]]")).toEqual({
      _tag: "RestSegment",
      name: "path",
      optional: true,
    })
  })

  t.test("parses param with prefix", () => {
    t.expect(RouterPattern.parseSegment("pk_[id]")).toEqual({
      _tag: "ParamSegment",
      name: "id",
      prefix: "pk_",
    })
  })

  t.test("parses param with suffix", () => {
    t.expect(RouterPattern.parseSegment("[id].json")).toEqual({
      _tag: "ParamSegment",
      name: "id",
      suffix: ".json",
    })
  })

  t.test("accepts Unicode literals", () => {
    t.expect(RouterPattern.parseSegment("café")).toEqual({
      _tag: "LiteralSegment",
      value: "café",
    })
    t.expect(RouterPattern.parseSegment("日本語")).toEqual({
      _tag: "LiteralSegment",
      value: "日本語",
    })
    t.expect(RouterPattern.parseSegment("москва")).toEqual({
      _tag: "LiteralSegment",
      value: "москва",
    })
  })

  t.test("accepts safe punctuation in literals", () => {
    t.expect(RouterPattern.parseSegment("file.txt")).toEqual({
      _tag: "LiteralSegment",
      value: "file.txt",
    })
    t.expect(RouterPattern.parseSegment("my-file")).toEqual({
      _tag: "LiteralSegment",
      value: "my-file",
    })
    t.expect(RouterPattern.parseSegment("my_file")).toEqual({
      _tag: "LiteralSegment",
      value: "my_file",
    })
    t.expect(RouterPattern.parseSegment("file~1")).toEqual({
      _tag: "LiteralSegment",
      value: "file~1",
    })
  })

  t.test("rejects invalid literal segments", () => {
    t.expect(RouterPattern.parseSegment("invalid$char")).toBe(null)
    t.expect(RouterPattern.parseSegment("has%20spaces")).toBe(null)
    t.expect(RouterPattern.parseSegment("special@char")).toBe(null)
    t.expect(RouterPattern.parseSegment("bad#hash")).toBe(null)
    t.expect(RouterPattern.parseSegment("with spaces")).toBe(null)
    t.expect(RouterPattern.parseSegment("")).toBe(null)
  })
})

t.describe("parse", () => {
  t.test("parses simple paths", () => {
    t.expect(RouterPattern.parse("/users")).toEqual([
      { _tag: "LiteralSegment", value: "users" },
    ])
    t.expect(RouterPattern.parse("/users/profile")).toEqual([
      { _tag: "LiteralSegment", value: "users" },
      { _tag: "LiteralSegment", value: "profile" },
    ])
  })

  t.test("parses paths with params", () => {
    t.expect(RouterPattern.parse("/users/[id]")).toEqual([
      { _tag: "LiteralSegment", value: "users" },
      { _tag: "ParamSegment", name: "id" },
    ])
  })

  t.test("parses Unicode paths", () => {
    t.expect(RouterPattern.parse("/café/日本語/москва")).toEqual([
      { _tag: "LiteralSegment", value: "café" },
      { _tag: "LiteralSegment", value: "日本語" },
      { _tag: "LiteralSegment", value: "москва" },
    ])
  })

  t.test("throws on invalid segments", () => {
    t.expect(() => RouterPattern.parse("/users/$invalid")).toThrow(
      /Invalid path segment.*contains invalid characters/,
    )
    t.expect(() => RouterPattern.parse("/path%20encoded")).toThrow()
    t.expect(() => RouterPattern.parse("/special@char")).toThrow()
    t.expect(() => RouterPattern.parse("/has spaces")).toThrow()
  })
})
