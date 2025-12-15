import * as Headers from "@effect/platform/Headers"
import * as t from "bun:test"
import * as ContentNegotiation from "./ContentNegotiation.ts"

t.describe("ContentNegotiation.media", () => {
  t.it("returns empty array when no types provided", () => {
    const result = ContentNegotiation.media("text/html", [])
    t.expect(result).toEqual([])
  })

  t.it("returns matching type", () => {
    const result = ContentNegotiation.media(
      "application/json",
      ["text/html", "application/json"],
    )
    t.expect(result).toEqual(["application/json"])
  })

  t.it("returns types sorted by quality", () => {
    const result = ContentNegotiation.media(
      "text/html;q=0.5, application/json;q=0.9",
      ["text/html", "application/json"],
    )
    t.expect(result).toEqual(["application/json", "text/html"])
  })

  t.it("returns empty array when no matching type", () => {
    const result = ContentNegotiation.media(
      "text/plain",
      ["text/html", "application/json"],
    )
    t.expect(result).toEqual([])
  })

  t.it("handles wildcard subtype", () => {
    const result = ContentNegotiation.media(
      "text/*",
      ["application/json", "text/html", "text/plain"],
    )
    t.expect(result).toEqual(["text/html", "text/plain"])
  })

  t.it("prefers exact match over wildcard", () => {
    const result = ContentNegotiation.media(
      "text/*, text/html",
      ["text/plain", "text/html"],
    )
    t.expect(result).toEqual(["text/html", "text/plain"])
  })

  t.it("handles complex accept header", () => {
    const result = ContentNegotiation.media(
      "text/html, application/*;q=0.2, image/jpeg;q=0.8",
      ["image/jpeg", "application/json", "text/html"],
    )
    t.expect(result).toEqual(["text/html", "image/jpeg", "application/json"])
  })

  t.it("returns type as provided (preserves original string)", () => {
    const result = ContentNegotiation.media(
      "application/json",
      ["text/HTML", "Application/JSON"],
    )
    t.expect(result).toEqual(["Application/JSON"])
  })

  t.it("handles */* wildcard", () => {
    const result = ContentNegotiation.media(
      "*/*",
      ["text/html", "application/json"],
    )
    t.expect(result).toEqual(["text/html", "application/json"])
  })

  t.it("returns empty array for invalid accept header", () => {
    const result = ContentNegotiation.media(
      "invalid",
      ["text/html", "application/json"],
    )
    t.expect(result).toEqual([])
  })

  t.it("returns all accepted types when available not provided", () => {
    const result = ContentNegotiation.media(
      "text/html, application/json;q=0.9, text/plain;q=0.5",
    )
    t.expect(result).toEqual(["text/html", "application/json", "text/plain"])
  })

  t.it("returns empty array for empty accept header", () => {
    const result = ContentNegotiation.media("", [
      "text/html",
      "application/json",
    ])
    t.expect(result).toEqual([])
  })

  t.it("excludes types with q=0", () => {
    const result = ContentNegotiation.media(
      "text/html, application/json;q=0",
      ["text/html", "application/json"],
    )
    t.expect(result).toEqual(["text/html"])
  })

  t.it("matches media type with parameters", () => {
    const result = ContentNegotiation.media(
      "text/html;level=1",
      ["text/html;level=1", "text/html;level=2", "text/html"],
    )
    t.expect(result).toEqual(["text/html;level=1"])
  })

  t.it("prefers more specific wildcard match", () => {
    const result = ContentNegotiation.media(
      "text/*;q=0.5, */*;q=0.1",
      ["text/html", "application/json"],
    )
    t.expect(result).toEqual(["text/html", "application/json"])
  })
})

t.describe("ContentNegotiation.language", () => {
  t.it("returns empty array when no languages provided", () => {
    const result = ContentNegotiation.language("en", [])
    t.expect(result).toEqual([])
  })

  t.it("returns matching language", () => {
    const result = ContentNegotiation.language("fr", ["en", "fr"])
    t.expect(result).toEqual(["fr"])
  })

  t.it("returns languages sorted by quality", () => {
    const result = ContentNegotiation.language(
      "en;q=0.5, fr;q=0.9",
      ["en", "fr"],
    )
    t.expect(result).toEqual(["fr", "en"])
  })

  t.it("returns empty array when no matching language", () => {
    const result = ContentNegotiation.language("de", ["en", "fr"])
    t.expect(result).toEqual([])
  })

  t.it("handles language prefix match", () => {
    const result = ContentNegotiation.language("en", ["en-US", "en-GB", "fr"])
    t.expect(result).toEqual(["en-US", "en-GB"])
  })

  t.it("handles language with region", () => {
    const result = ContentNegotiation.language("en-US", ["en", "en-US", "fr"])
    t.expect(result).toEqual(["en-US"])
  })

  t.it("prefers exact match over prefix match", () => {
    const result = ContentNegotiation.language(
      "en-US, en;q=0.9",
      ["en", "en-US"],
    )
    t.expect(result).toEqual(["en-US", "en"])
  })

  t.it("handles complex accept-language header", () => {
    const result = ContentNegotiation.language(
      "en;q=0.8, es, pt",
      ["en", "es", "pt"],
    )
    t.expect(result).toEqual(["es", "pt", "en"])
  })

  t.it("handles * wildcard", () => {
    const result = ContentNegotiation.language("*", ["en", "fr"])
    t.expect(result).toEqual(["en", "fr"])
  })

  t.it("returns all accepted languages when available not provided", () => {
    const result = ContentNegotiation.language("en-US, fr;q=0.8, de;q=0.5")
    t.expect(result).toEqual(["en-us", "fr", "de"])
  })

  t.it("returns empty array for empty accept-language header", () => {
    const result = ContentNegotiation.language("", ["en", "fr"])
    t.expect(result).toEqual([])
  })

  t.it("matches case-insensitively", () => {
    const result = ContentNegotiation.language("EN-US", ["en-us", "fr"])
    t.expect(result).toEqual(["en-us"])
  })
})

t.describe("ContentNegotiation.encoding", () => {
  t.it("returns empty array when no encodings provided", () => {
    const result = ContentNegotiation.encoding("gzip", [])
    t.expect(result).toEqual([])
  })

  t.it("returns matching encoding", () => {
    const result = ContentNegotiation.encoding("deflate", ["gzip", "deflate"])
    t.expect(result).toEqual(["deflate"])
  })

  t.it("returns encodings sorted by quality", () => {
    const result = ContentNegotiation.encoding(
      "gzip;q=0.5, deflate;q=0.9",
      ["gzip", "deflate"],
    )
    t.expect(result).toEqual(["deflate", "gzip"])
  })

  t.it(
    "returns empty array when no matching encoding (except identity)",
    () => {
      const result = ContentNegotiation.encoding("br", ["gzip", "deflate"])
      t.expect(result).toEqual([])
    },
  )

  t.it("handles wildcard", () => {
    const result = ContentNegotiation.encoding("*", ["gzip", "deflate"])
    t.expect(result).toEqual(["gzip", "deflate"])
  })

  t.it("handles identity encoding as implicit fallback", () => {
    const result = ContentNegotiation.encoding("br", ["identity", "gzip"])
    t.expect(result).toEqual(["identity"])
  })

  t.it("handles complex accept-encoding header", () => {
    const result = ContentNegotiation.encoding(
      "gzip;q=1.0, identity;q=0.5, *;q=0",
      ["deflate", "gzip", "identity"],
    )
    t.expect(result).toEqual(["gzip", "identity"])
  })

  t.it("returns all accepted encodings when available not provided", () => {
    const result = ContentNegotiation.encoding("gzip, deflate;q=0.8, br;q=0.5")
    t.expect(result).toEqual(["gzip", "deflate", "br", "identity"])
  })

  t.it("returns empty array for empty accept-encoding header", () => {
    const result = ContentNegotiation.encoding("", ["gzip", "deflate"])
    t.expect(result).toEqual([])
  })

  t.it("excludes identity when identity;q=0", () => {
    const result = ContentNegotiation.encoding(
      "gzip, identity;q=0",
      ["gzip", "identity"],
    )
    t.expect(result).toEqual(["gzip"])
  })

  t.it("excludes unspecified encodings when *;q=0", () => {
    const result = ContentNegotiation.encoding(
      "gzip, *;q=0",
      ["gzip", "deflate", "br"],
    )
    t.expect(result).toEqual(["gzip"])
  })
})

t.describe("ContentNegotiation.charset", () => {
  t.it("returns empty array when no charsets provided", () => {
    const result = ContentNegotiation.charset("utf-8", [])
    t.expect(result).toEqual([])
  })

  t.it("returns matching charset", () => {
    const result = ContentNegotiation.charset(
      "iso-8859-1",
      ["utf-8", "iso-8859-1"],
    )
    t.expect(result).toEqual(["iso-8859-1"])
  })

  t.it("returns charsets sorted by quality", () => {
    const result = ContentNegotiation.charset(
      "utf-8;q=0.5, iso-8859-1;q=0.9",
      ["utf-8", "iso-8859-1"],
    )
    t.expect(result).toEqual(["iso-8859-1", "utf-8"])
  })

  t.it("returns empty array when no matching charset", () => {
    const result = ContentNegotiation.charset(
      "utf-16",
      ["utf-8", "iso-8859-1"],
    )
    t.expect(result).toEqual([])
  })

  t.it("handles wildcard", () => {
    const result = ContentNegotiation.charset("*", ["utf-8", "iso-8859-1"])
    t.expect(result).toEqual(["utf-8", "iso-8859-1"])
  })

  t.it("handles complex accept-charset header", () => {
    const result = ContentNegotiation.charset(
      "utf-8, iso-8859-1;q=0.8, utf-7;q=0.2",
      ["utf-7", "iso-8859-1", "utf-8"],
    )
    t.expect(result).toEqual(["utf-8", "iso-8859-1", "utf-7"])
  })

  t.it("returns all accepted charsets when available not provided", () => {
    const result = ContentNegotiation.charset(
      "utf-8, iso-8859-1;q=0.8, utf-7;q=0.2",
    )
    t.expect(result).toEqual(["utf-8", "iso-8859-1", "utf-7"])
  })

  t.it("returns empty array for empty accept-charset header", () => {
    const result = ContentNegotiation.charset("", ["utf-8", "iso-8859-1"])
    t.expect(result).toEqual([])
  })

  t.it("matches case-insensitively", () => {
    const result = ContentNegotiation.charset("UTF-8", ["utf-8", "iso-8859-1"])
    t.expect(result).toEqual(["utf-8"])
  })
})

t.describe("ContentNegotiation.headerMedia", () => {
  t.it("parses Accept header from Headers object", () => {
    const headers = Headers.fromInput({ accept: "text/html, application/json" })
    const result = ContentNegotiation.headerMedia(headers, [
      "text/html",
      "application/json",
    ])
    t.expect(result).toEqual(["text/html", "application/json"])
  })

  t.it("returns empty array when Accept header is missing", () => {
    const headers = Headers.fromInput({})
    const result = ContentNegotiation.headerMedia(headers, ["text/html"])
    t.expect(result).toEqual([])
  })
})

t.describe("ContentNegotiation.headerLanguage", () => {
  t.it("parses Accept-Language header from Headers object", () => {
    const headers = Headers.fromInput({ "accept-language": "en, fr;q=0.8" })
    const result = ContentNegotiation.headerLanguage(headers, ["en", "fr"])
    t.expect(result).toEqual(["en", "fr"])
  })

  t.it("returns empty array when Accept-Language header is missing", () => {
    const headers = Headers.fromInput({})
    const result = ContentNegotiation.headerLanguage(headers, ["en"])
    t.expect(result).toEqual([])
  })
})

t.describe("ContentNegotiation.headerEncoding", () => {
  t.it("parses Accept-Encoding header from Headers object", () => {
    const headers = Headers.fromInput({ "accept-encoding": "gzip, deflate" })
    const result = ContentNegotiation.headerEncoding(headers, [
      "gzip",
      "deflate",
    ])
    t.expect(result).toEqual(["gzip", "deflate"])
  })

  t.it("returns empty array when Accept-Encoding header is missing", () => {
    const headers = Headers.fromInput({})
    const result = ContentNegotiation.headerEncoding(headers, ["gzip"])
    t.expect(result).toEqual([])
  })
})

t.describe("ContentNegotiation.headerCharset", () => {
  t.it("parses Accept-Charset header from Headers object", () => {
    const headers = Headers.fromInput({ "accept-charset": "utf-8, iso-8859-1" })
    const result = ContentNegotiation.headerCharset(headers, [
      "utf-8",
      "iso-8859-1",
    ])
    t.expect(result).toEqual(["utf-8", "iso-8859-1"])
  })

  t.it("returns empty array when Accept-Charset header is missing", () => {
    const headers = Headers.fromInput({})
    const result = ContentNegotiation.headerCharset(headers, ["utf-8"])
    t.expect(result).toEqual([])
  })
})
