import * as test from "bun:test"
import * as type from "expect-type"
import * as RouterPattern from "./RouterPattern.ts"

test.describe("Segments", () => {
  test.it("literal path", () => {
    type
      .expectTypeOf<RouterPattern.Segments<"/">>()
      .toEqualTypeOf<[]>()
    type
      .expectTypeOf<RouterPattern.Segments<"/about">>()
      .toEqualTypeOf<[RouterPattern.LiteralSegment<"about">]>()
    type
      .expectTypeOf<RouterPattern.Segments<"/users/profile">>()
      .toEqualTypeOf<[
        RouterPattern.LiteralSegment<"users">,
        RouterPattern.LiteralSegment<"profile">,
      ]>()
  })

  test.it("simple param [param]", () => {
    type
      .expectTypeOf<RouterPattern.Segments<"/users/[id]">>()
      .toEqualTypeOf<[
        RouterPattern.LiteralSegment<"users">,
        RouterPattern.ParamSegment<"id", false>,
      ]>()
    type
      .expectTypeOf<RouterPattern.Segments<"/[category]/[product]">>()
      .toEqualTypeOf<[
        RouterPattern.ParamSegment<"category", false>,
        RouterPattern.ParamSegment<"product", false>,
      ]>()
  })

  test.it("optional param [[param]]", () => {
    type
      .expectTypeOf<RouterPattern.Segments<"/users/[[id]]">>()
      .toEqualTypeOf<[
        RouterPattern.LiteralSegment<"users">,
        RouterPattern.ParamSegment<"id", true>,
      ]>()
  })

  test.it("rest param [...param]", () => {
    type
      .expectTypeOf<RouterPattern.Segments<"/docs/[...path]">>()
      .toEqualTypeOf<[
        RouterPattern.LiteralSegment<"docs">,
        RouterPattern.RestSegment<"path", false>,
      ]>()
  })

  test.it("optional rest param [[...param]]", () => {
    type
      .expectTypeOf<RouterPattern.Segments<"/[[...frontend]]">>()
      .toEqualTypeOf<[RouterPattern.RestSegment<"frontend", true>]>()
    type
      .expectTypeOf<RouterPattern.Segments<"/app/[[...slug]]">>()
      .toEqualTypeOf<[
        RouterPattern.LiteralSegment<"app">,
        RouterPattern.RestSegment<"slug", true>,
      ]>()
  })

  test.it("param with prefix pk_[id]", () => {
    type
      .expectTypeOf<RouterPattern.Segments<"/keys/pk_[id]">>()
      .toEqualTypeOf<[
        RouterPattern.LiteralSegment<"keys">,
        RouterPattern.ParamSegment<"id", false, "pk_">,
      ]>()
  })

  test.it("param with suffix [id].json", () => {
    type
      .expectTypeOf<RouterPattern.Segments<"/api/[id].json">>()
      .toEqualTypeOf<[
        RouterPattern.LiteralSegment<"api">,
        RouterPattern.ParamSegment<"id", false, "", ".json">,
      ]>()
  })

  test.it("param with prefix and suffix file_[id].txt", () => {
    type
      .expectTypeOf<RouterPattern.Segments<"/files/file_[id].txt">>()
      .toEqualTypeOf<[
        RouterPattern.LiteralSegment<"files">,
        RouterPattern.ParamSegment<"id", false, "file_", ".txt">,
      ]>()
  })

  test.it("param with prefix and suffix prefix_[id]_suffix", () => {
    type
      .expectTypeOf<RouterPattern.Segments<"/prefix_[id]_suffix">>()
      .toEqualTypeOf<[RouterPattern.ParamSegment<"id", false, "prefix_", "_suffix">]>()
  })

  test.it("malformed segment pk_[id]foo → undefined (suffix without delimiter)", () => {
    type
      .expectTypeOf<RouterPattern.Segments<"/pk_[id]foo">>()
      .toEqualTypeOf<[undefined]>()
  })

  test.it("no delimiter prefix/suffix → Literal", () => {
    type
      .expectTypeOf<RouterPattern.Segments<"/pk[id]foo">>()
      .toEqualTypeOf<[RouterPattern.LiteralSegment<"pk[id]foo">]>()
  })
})

test.describe(`${RouterPattern.toColon.name}`, () => {
  test.it("literal path unchanged", () => {
    test
      .expect(RouterPattern.toColon("/"))
      .toEqual(["/"])
    test
      .expect(RouterPattern.toColon("/about"))
      .toEqual(["/about"])
    test
      .expect(RouterPattern.toColon("/users/profile"))
      .toEqual(["/users/profile"])
  })

  test.it("param [param] -> :param", () => {
    test
      .expect(RouterPattern.toColon("/users/[id]"))
      .toEqual(["/users/:id"])
    test
      .expect(RouterPattern.toColon("/[category]/[product]"))
      .toEqual(["/:category/:product"])
  })

  test.it("optional param [[param]] -> :param?", () => {
    test
      .expect(RouterPattern.toColon("/users/[[id]]"))
      .toEqual(["/users/:id?"])
    test
      .expect(RouterPattern.toColon("/[[lang]]/about"))
      .toEqual(["/:lang?/about"])
  })

  test.it("rest [...param] -> *", () => {
    test
      .expect(RouterPattern.toColon("/docs/[...path]"))
      .toEqual(["/docs/*"])
    test
      .expect(RouterPattern.toColon("/files/[...rest]"))
      .toEqual(["/files/*"])
  })

  test.it("optional rest [[...param]] -> two routes", () => {
    test
      .expect(RouterPattern.toColon("/[[...frontend]]"))
      .toEqual(["/", "/*"])
    test
      .expect(RouterPattern.toColon("/app/[[...slug]]"))
      .toEqual(["/app", "/app/*"])
    test
      .expect(RouterPattern.toColon("/docs/[[...path]]"))
      .toEqual(["/docs", "/docs/*"])
  })

  test.it("param with prefix pk_[id] -> pk_:id", () => {
    test
      .expect(RouterPattern.toColon("/keys/pk_[id]"))
      .toEqual(["/keys/pk_:id"])
    test
      .expect(RouterPattern.toColon("/sk_[key]"))
      .toEqual(["/sk_:key"])
  })

  test.it("param with suffix [name].json -> :name.json", () => {
    test
      .expect(RouterPattern.toColon("/api/[id].json"))
      .toEqual(["/api/:id.json"])
  })

  test.it("param with prefix and suffix", () => {
    test
      .expect(RouterPattern.toColon("/files/file_[id].txt"))
      .toEqual(["/files/file_:id.txt"])
  })
})

test.describe(`${RouterPattern.toBun.name}`, () => {
  test.it("literal path unchanged", () => {
    test
      .expect(RouterPattern.toBun("/"))
      .toEqual(["/"])
    test
      .expect(RouterPattern.toBun("/about"))
      .toEqual(["/about"])
  })

  test.it("param [param] -> :param", () => {
    test
      .expect(RouterPattern.toBun("/users/[id]"))
      .toEqual(["/users/:id"])
  })

  test.it("optional param [[param]] -> two routes", () => {
    test
      .expect(RouterPattern.toBun("/users/[[id]]"))
      .toEqual(["/users", "/users/:id"])
    test
      .expect(RouterPattern.toBun("/[[id]]"))
      .toEqual(["/", "/:id"])
  })

  test.it("rest param [...param] -> *", () => {
    test
      .expect(RouterPattern.toBun("/docs/[...path]"))
      .toEqual(["/docs/*"])
  })

  test.it("optional rest param [[...param]] -> two routes", () => {
    test
      .expect(RouterPattern.toBun("/docs/[[...path]]"))
      .toEqual(["/docs", "/docs/*"])
    test
      .expect(RouterPattern.toBun("/[[...path]]"))
      .toEqual(["/", "/*"])
  })
})

test.describe(`${RouterPattern.toExpress.name}`, () => {
  test.it("literal path unchanged", () => {
    test
      .expect(RouterPattern.toExpress("/"))
      .toEqual(["/"])
    test
      .expect(RouterPattern.toExpress("/about"))
      .toEqual(["/about"])
  })

  test.it("param [param] -> :param", () => {
    test
      .expect(RouterPattern.toExpress("/users/[id]"))
      .toEqual(["/users/:id"])
  })

  test.it("optional param [[param]] -> {/:param}", () => {
    test
      .expect(RouterPattern.toExpress("/users/[[id]]"))
      .toEqual(["/users{/:id}"])
    test
      .expect(RouterPattern.toExpress("/[[lang]]/about"))
      .toEqual(["/{/:lang}/about"])
  })

  test.it("rest [...param] -> /*param", () => {
    test
      .expect(RouterPattern.toExpress("/docs/[...path]"))
      .toEqual(["/docs/*path"])
    test
      .expect(RouterPattern.toExpress("/files/[...rest]"))
      .toEqual(["/files/*rest"])
  })

  test.it("optional rest [[...param]] -> two routes", () => {
    test
      .expect(RouterPattern.toExpress("/[[...frontend]]"))
      .toEqual(["/", "/*frontend"])
    test
      .expect(RouterPattern.toExpress("/app/[[...slug]]"))
      .toEqual(["/app", "/app/*slug"])
  })

  test.it("param with prefix pk_[id] -> pk_:id", () => {
    test
      .expect(RouterPattern.toExpress("/keys/pk_[id]"))
      .toEqual(["/keys/pk_:id"])
  })
})

test.describe(`${RouterPattern.toEffect.name}`, () => {
  test.it("literal path unchanged", () => {
    test
      .expect(RouterPattern.toEffect("/"))
      .toEqual(["/"])
    test
      .expect(RouterPattern.toEffect("/about"))
      .toEqual(["/about"])
  })

  test.it("param [param] -> :param", () => {
    test
      .expect(RouterPattern.toEffect("/users/[id]"))
      .toEqual(["/users/:id"])
  })

  test.it("optional param [[param]] -> :param?", () => {
    test
      .expect(RouterPattern.toEffect("/users/[[id]]"))
      .toEqual(["/users/:id?"])
  })

  test.it("rest [...param] -> *", () => {
    test
      .expect(RouterPattern.toEffect("/docs/[...path]"))
      .toEqual(["/docs/*"])
  })

  test.it("optional rest [[...param]] -> two routes", () => {
    test
      .expect(RouterPattern.toEffect("/[[...frontend]]"))
      .toEqual(["/", "/*"])
    test
      .expect(RouterPattern.toEffect("/app/[[...slug]]"))
      .toEqual(["/app", "/app/*"])
  })

  test.it("param with prefix pk_[id] -> pk_:id", () => {
    test
      .expect(RouterPattern.toEffect("/keys/pk_[id]"))
      .toEqual(["/keys/pk_:id"])
  })
})

test.describe(`${RouterPattern.toURLPattern.name}`, () => {
  test.it("literal path unchanged", () => {
    test
      .expect(RouterPattern.toURLPattern("/"))
      .toEqual(["/"])
    test
      .expect(RouterPattern.toURLPattern("/about"))
      .toEqual(["/about"])
  })

  test.it("param [param] -> :param", () => {
    test
      .expect(RouterPattern.toURLPattern("/users/[id]"))
      .toEqual(["/users/:id"])
  })

  test.it("optional param [[param]] -> :param?", () => {
    test
      .expect(RouterPattern.toURLPattern("/users/[[id]]"))
      .toEqual(["/users/:id?"])
  })

  test.it("rest [...param] -> :param+", () => {
    test
      .expect(RouterPattern.toURLPattern("/docs/[...path]"))
      .toEqual(["/docs/:path+"])
  })

  test.it("optional rest [[...param]] -> :param*", () => {
    test
      .expect(RouterPattern.toURLPattern("/[[...frontend]]"))
      .toEqual(["/:frontend*"])
    test
      .expect(RouterPattern.toURLPattern("/app/[[...slug]]"))
      .toEqual(["/app/:slug*"])
  })

  test.it("param with prefix pk_[id] -> pk_:id", () => {
    test
      .expect(RouterPattern.toURLPattern("/keys/pk_[id]"))
      .toEqual(["/keys/pk_:id"])
  })
})

test.describe(`${RouterPattern.toRemix.name}`, () => {
  test.it("literal path unchanged", () => {
    test
      .expect(RouterPattern.toRemix("/"))
      .toEqual(["/"])
    test
      .expect(RouterPattern.toRemix("/about"))
      .toEqual(["/about"])
  })

  test.it("param [param] -> $param", () => {
    test
      .expect(RouterPattern.toRemix("/users/[id]"))
      .toEqual(["/users/$id"])
  })

  test.it("optional param [[param]] -> ($param)", () => {
    test
      .expect(RouterPattern.toRemix("/users/[[id]]"))
      .toEqual(["/users/($id)"])
  })

  test.it("rest [...param] -> $", () => {
    test
      .expect(RouterPattern.toRemix("/docs/[...path]"))
      .toEqual(["/docs/$"])
  })

  test.it("optional rest [[...param]] -> two routes", () => {
    test
      .expect(RouterPattern.toRemix("/[[...frontend]]"))
      .toEqual(["/", "$"])
    test
      .expect(RouterPattern.toRemix("/app/[[...slug]]"))
      .toEqual(["/app", "/app/$"])
  })

  test.it("param with prefix pk_[id] -> pk_$id (not officially supported)", () => {
    test
      .expect(RouterPattern.toRemix("/keys/pk_[id]"))
      .toEqual(["/keys/pk_$id"])
  })
})

test.describe(`${RouterPattern.format.name}`, () => {
  test.it("empty segments", () => {
    test
      .expect(RouterPattern.format([]))
      .toBe("/")
  })

  test.it("literal segments", () => {
    test
      .expect(RouterPattern.format([{ _tag: "LiteralSegment", value: "users" }]))
      .toBe("/users")
    test
      .expect(RouterPattern.format([
        { _tag: "LiteralSegment", value: "users" },
        { _tag: "LiteralSegment", value: "profile" },
      ]))
      .toBe("/users/profile")
  })

  test.it("param segments", () => {
    test
      .expect(RouterPattern.format([{ _tag: "ParamSegment", name: "id" }]))
      .toBe("/[id]")
    test
      .expect(RouterPattern.format([{
        _tag: "ParamSegment",
        name: "id",
        optional: true,
      }]))
      .toBe("/[[id]]")
  })

  test.it("param with prefix/suffix", () => {
    test
      .expect(RouterPattern.format([{
        _tag: "ParamSegment",
        name: "id",
        prefix: "pk_",
      }]))
      .toBe("/pk_[id]")
    test
      .expect(RouterPattern.format([{
        _tag: "ParamSegment",
        name: "id",
        suffix: ".json",
      }]))
      .toBe("/[id].json")
    test
      .expect(RouterPattern.format([
        { _tag: "ParamSegment", name: "id", prefix: "file_", suffix: ".txt" },
      ]))
      .toBe("/file_[id].txt")
  })

  test.it("rest segments", () => {
    test
      .expect(RouterPattern.format([{ _tag: "RestSegment", name: "path" }]))
      .toBe("/[...path]")
    test
      .expect(RouterPattern.format([{
        _tag: "RestSegment",
        name: "path",
        optional: true,
      }]))
      .toBe("/[[...path]]")
  })

  test.it("mixed segments", () => {
    test
      .expect(RouterPattern.format([
        { _tag: "LiteralSegment", value: "users" },
        { _tag: "ParamSegment", name: "id" },
        { _tag: "LiteralSegment", value: "posts" },
      ]))
      .toBe("/users/[id]/posts")
  })
})

test.describe("parseSegment", () => {
  test.it("parses literal segments", () => {
    test
      .expect(RouterPattern.parseSegment("users"))
      .toEqual({
        _tag: "LiteralSegment",
        value: "users",
      })
  })

  test.it("parses param segments", () => {
    test
      .expect(RouterPattern.parseSegment("[id]"))
      .toEqual({
        _tag: "ParamSegment",
        name: "id",
      })
  })

  test.it("parses optional param segments", () => {
    test
      .expect(RouterPattern.parseSegment("[[id]]"))
      .toEqual({
        _tag: "ParamSegment",
        name: "id",
        optional: true,
      })
  })

  test.it("parses rest segments", () => {
    test
      .expect(RouterPattern.parseSegment("[...path]"))
      .toEqual({
        _tag: "RestSegment",
        name: "path",
      })
  })

  test.it("parses optional rest segments", () => {
    test
      .expect(RouterPattern.parseSegment("[[...path]]"))
      .toEqual({
        _tag: "RestSegment",
        name: "path",
        optional: true,
      })
  })

  test.it("parses param with prefix", () => {
    test
      .expect(RouterPattern.parseSegment("pk_[id]"))
      .toEqual({
        _tag: "ParamSegment",
        name: "id",
        prefix: "pk_",
      })
  })

  test.it("parses param with suffix", () => {
    test
      .expect(RouterPattern.parseSegment("[id].json"))
      .toEqual({
        _tag: "ParamSegment",
        name: "id",
        suffix: ".json",
      })
  })

  test.it("accepts Unicode literals", () => {
    test
      .expect(RouterPattern.parseSegment("café"))
      .toEqual({
        _tag: "LiteralSegment",
        value: "café",
      })
    test
      .expect(RouterPattern.parseSegment("日本語"))
      .toEqual({
        _tag: "LiteralSegment",
        value: "日本語",
      })
    test
      .expect(RouterPattern.parseSegment("москва"))
      .toEqual({
        _tag: "LiteralSegment",
        value: "москва",
      })
  })

  test.it("accepts safe punctuation in literals", () => {
    test
      .expect(RouterPattern.parseSegment("file.txt"))
      .toEqual({
        _tag: "LiteralSegment",
        value: "file.txt",
      })
    test
      .expect(RouterPattern.parseSegment("my-file"))
      .toEqual({
        _tag: "LiteralSegment",
        value: "my-file",
      })
    test
      .expect(RouterPattern.parseSegment("my_file"))
      .toEqual({
        _tag: "LiteralSegment",
        value: "my_file",
      })
    test
      .expect(RouterPattern.parseSegment("file~1"))
      .toEqual({
        _tag: "LiteralSegment",
        value: "file~1",
      })
  })

  test.it("rejects invalid literal segments", () => {
    test
      .expect(RouterPattern.parseSegment("invalid$char"))
      .toBe(null)
    test
      .expect(RouterPattern.parseSegment("has%20spaces"))
      .toBe(null)
    test
      .expect(RouterPattern.parseSegment("special@char"))
      .toBe(null)
    test
      .expect(RouterPattern.parseSegment("bad#hash"))
      .toBe(null)
    test
      .expect(RouterPattern.parseSegment("with spaces"))
      .toBe(null)
    test
      .expect(RouterPattern.parseSegment(""))
      .toBe(null)
  })
})

test.describe("parse", () => {
  test.it("parses simple paths", () => {
    test
      .expect(RouterPattern.parse("/users"))
      .toEqual([
        { _tag: "LiteralSegment", value: "users" },
      ])
    test
      .expect(RouterPattern.parse("/users/profile"))
      .toEqual([
        { _tag: "LiteralSegment", value: "users" },
        { _tag: "LiteralSegment", value: "profile" },
      ])
  })

  test.it("parses paths with params", () => {
    test
      .expect(RouterPattern.parse("/users/[id]"))
      .toEqual([
        { _tag: "LiteralSegment", value: "users" },
        { _tag: "ParamSegment", name: "id" },
      ])
  })

  test.it("parses Unicode paths", () => {
    test
      .expect(RouterPattern.parse("/café/日本語/москва"))
      .toEqual([
        { _tag: "LiteralSegment", value: "café" },
        { _tag: "LiteralSegment", value: "日本語" },
        { _tag: "LiteralSegment", value: "москва" },
      ])
  })

  test.it("throws on invalid segments", () => {
    test
      .expect(() => RouterPattern.parse("/users/$invalid"))
      .toThrow(/Invalid path segment.*contains invalid characters/)
    test
      .expect(() => RouterPattern.parse("/path%20encoded"))
      .toThrow()
    test
      .expect(() => RouterPattern.parse("/special@char"))
      .toThrow()
    test
      .expect(() => RouterPattern.parse("/has spaces"))
      .toThrow()
  })
})
