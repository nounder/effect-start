import * as test from "bun:test"
import * as ContentNegotiation from "./ContentNegotiation.ts"

test.describe("ContentNegotiation.media", () => {
  test.it("returns empty array when no types provided", () => {
    const result = ContentNegotiation.media("text/html", [])

    test
      .expect(result)
      .toEqual([])
  })

  test.it("returns matching type", () => {
    const result = ContentNegotiation.media(
      "application/json",
      ["text/html", "application/json"],
    )

    test
      .expect(result)
      .toEqual(["application/json"])
  })

  test.it("returns types sorted by quality", () => {
    const result = ContentNegotiation.media(
      "text/html;q=0.5, application/json;q=0.9",
      ["text/html", "application/json"],
    )

    test
      .expect(result)
      .toEqual(["application/json", "text/html"])
  })

  test.it("returns empty array when no matching type", () => {
    const result = ContentNegotiation.media(
      "text/plain",
      ["text/html", "application/json"],
    )

    test
      .expect(result)
      .toEqual([])
  })

  test.it("handles wildcard subtype", () => {
    const result = ContentNegotiation.media(
      "text/*",
      ["application/json", "text/html", "text/plain"],
    )

    test
      .expect(result)
      .toEqual(["text/html", "text/plain"])
  })

  test.it("prefers exact match over wildcard", () => {
    const result = ContentNegotiation.media(
      "text/*, text/html",
      ["text/plain", "text/html"],
    )

    test
      .expect(result)
      .toEqual(["text/html", "text/plain"])
  })

  test.it("handles complex accept header", () => {
    const result = ContentNegotiation.media(
      "text/html, application/*;q=0.2, image/jpeg;q=0.8",
      ["image/jpeg", "application/json", "text/html"],
    )

    test
      .expect(result)
      .toEqual(["text/html", "image/jpeg", "application/json"])
  })

  test.it("returns type as provided (preserves original string)", () => {
    const result = ContentNegotiation.media(
      "application/json",
      ["text/HTML", "Application/JSON"],
    )

    test
      .expect(result)
      .toEqual(["Application/JSON"])
  })

  test.it("handles */* wildcard", () => {
    const result = ContentNegotiation.media(
      "*/*",
      ["text/html", "application/json"],
    )

    test
      .expect(result)
      .toEqual(["text/html", "application/json"])
  })

  test.it("returns empty array for invalid accept header", () => {
    const result = ContentNegotiation.media(
      "invalid",
      ["text/html", "application/json"],
    )

    test
      .expect(result)
      .toEqual([])
  })

  test.it("returns all accepted types when available not provided", () => {
    const result = ContentNegotiation.media(
      "text/html, application/json;q=0.9, text/plain;q=0.5",
    )

    test
      .expect(result)
      .toEqual(["text/html", "application/json", "text/plain"])
  })

  test.it("returns empty array for empty accept header", () => {
    const result = ContentNegotiation.media("", [
      "text/html",
      "application/json",
    ])

    test
      .expect(result)
      .toEqual([])
  })

  test.it("excludes types with q=0", () => {
    const result = ContentNegotiation.media(
      "text/html, application/json;q=0",
      ["text/html", "application/json"],
    )

    test
      .expect(result)
      .toEqual(["text/html"])
  })

  test.it("matches media type with parameters", () => {
    const result = ContentNegotiation.media(
      "text/html;level=1",
      ["text/html;level=1", "text/html;level=2", "text/html"],
    )

    test
      .expect(result)
      .toEqual(["text/html;level=1"])
  })

  test.it("prefers more specific wildcard match", () => {
    const result = ContentNegotiation.media(
      "text/*;q=0.5, */*;q=0.1",
      ["text/html", "application/json"],
    )

    test
      .expect(result)
      .toEqual(["text/html", "application/json"])
  })

  test.describe("wildcard in available types", () => {
    test.it("text/* matches text/event-stream", () => {
      const result = ContentNegotiation.media(
        "text/event-stream",
        ["text/*", "application/json"],
      )

      test
        .expect(result)
        .toEqual(["text/*"])
    })

    test.it("text/* matches text/markdown", () => {
      const result = ContentNegotiation.media(
        "text/markdown",
        ["text/*"],
      )

      test
        .expect(result)
        .toEqual(["text/*"])
    })

    test.it("text/* matches text/plain", () => {
      const result = ContentNegotiation.media(
        "text/plain",
        ["text/*"],
      )

      test
        .expect(result)
        .toEqual(["text/*"])
    })

    test.it("text/* does not match application/json", () => {
      const result = ContentNegotiation.media(
        "application/json",
        ["text/*"],
      )

      test
        .expect(result)
        .toEqual([])
    })

    test.it("prefers exact match over wildcard available type", () => {
      const result = ContentNegotiation.media(
        "text/html",
        ["text/*", "text/html"],
      )

      test
        .expect(result)
        .toEqual(["text/html", "text/*"])
    })

    test.it("text/* matches multiple text types in Accept", () => {
      const result = ContentNegotiation.media(
        "text/html, text/plain",
        ["text/*"],
      )

      test
        .expect(result)
        .toEqual(["text/*"])
    })

    test.it("application/* matches application/xml", () => {
      const result = ContentNegotiation.media(
        "application/xml",
        ["application/*", "text/html"],
      )

      test
        .expect(result)
        .toEqual(["application/*"])
    })

    test.it("*/* in available matches any type", () => {
      const result = ContentNegotiation.media(
        "image/png",
        ["*/*"],
      )

      test
        .expect(result)
        .toEqual(["*/*"])
    })

    test.it("combines client and server wildcards", () => {
      // Client wants text/*, server offers text/*
      const result = ContentNegotiation.media(
        "text/*",
        ["text/*"],
      )

      test
        .expect(result)
        .toEqual(["text/*"])
    })

    test.it("quality values still apply with wildcard available", () => {
      const result = ContentNegotiation.media(
        "text/html;q=0.5, text/event-stream;q=0.9",
        ["text/*"],
      )

      test
        .expect(result)
        .toEqual(["text/*"])
    })
  })
})

test.describe("ContentNegotiation.language", () => {
  test.it("returns empty array when no languages provided", () => {
    const result = ContentNegotiation.language("en", [])

    test
      .expect(result)
      .toEqual([])
  })

  test.it("returns matching language", () => {
    const result = ContentNegotiation.language("fr", ["en", "fr"])

    test
      .expect(result)
      .toEqual(["fr"])
  })

  test.it("returns languages sorted by quality", () => {
    const result = ContentNegotiation.language(
      "en;q=0.5, fr;q=0.9",
      ["en", "fr"],
    )

    test
      .expect(result)
      .toEqual(["fr", "en"])
  })

  test.it("returns empty array when no matching language", () => {
    const result = ContentNegotiation.language("de", ["en", "fr"])

    test
      .expect(result)
      .toEqual([])
  })

  test.it("handles language prefix match", () => {
    const result = ContentNegotiation.language("en", ["en-US", "en-GB", "fr"])

    test
      .expect(result)
      .toEqual(["en-US", "en-GB"])
  })

  test.it("handles language with region", () => {
    const result = ContentNegotiation.language("en-US", ["en", "en-US", "fr"])

    test
      .expect(result)
      .toEqual(["en-US"])
  })

  test.it("prefers exact match over prefix match", () => {
    const result = ContentNegotiation.language(
      "en-US, en;q=0.9",
      ["en", "en-US"],
    )

    test
      .expect(result)
      .toEqual(["en-US", "en"])
  })

  test.it("handles complex accept-language header", () => {
    const result = ContentNegotiation.language(
      "en;q=0.8, es, pt",
      ["en", "es", "pt"],
    )

    test
      .expect(result)
      .toEqual(["es", "pt", "en"])
  })

  test.it("handles * wildcard", () => {
    const result = ContentNegotiation.language("*", ["en", "fr"])

    test
      .expect(result)
      .toEqual(["en", "fr"])
  })

  test.it("returns all accepted languages when available not provided", () => {
    const result = ContentNegotiation.language("en-US, fr;q=0.8, de;q=0.5")

    test
      .expect(result)
      .toEqual(["en-us", "fr", "de"])
  })

  test.it("returns empty array for empty accept-language header", () => {
    const result = ContentNegotiation.language("", ["en", "fr"])

    test
      .expect(result)
      .toEqual([])
  })

  test.it("matches case-insensitively", () => {
    const result = ContentNegotiation.language("EN-US", ["en-us", "fr"])

    test
      .expect(result)
      .toEqual(["en-us"])
  })
})

test.describe("ContentNegotiation.encoding", () => {
  test.it("returns empty array when no encodings provided", () => {
    const result = ContentNegotiation.encoding("gzip", [])

    test
      .expect(result)
      .toEqual([])
  })

  test.it("returns matching encoding", () => {
    const result = ContentNegotiation.encoding("deflate", ["gzip", "deflate"])

    test
      .expect(result)
      .toEqual(["deflate"])
  })

  test.it("returns encodings sorted by quality", () => {
    const result = ContentNegotiation.encoding(
      "gzip;q=0.5, deflate;q=0.9",
      ["gzip", "deflate"],
    )

    test
      .expect(result)
      .toEqual(["deflate", "gzip"])
  })

  test.it(
    "returns empty array when no matching encoding (except identity)",
    () => {
      const result = ContentNegotiation.encoding("br", ["gzip", "deflate"])

      test
        .expect(result)
        .toEqual([])
    },
  )

  test.it("handles wildcard", () => {
    const result = ContentNegotiation.encoding("*", ["gzip", "deflate"])

    test
      .expect(result)
      .toEqual(["gzip", "deflate"])
  })

  test.it("handles identity encoding as implicit fallback", () => {
    const result = ContentNegotiation.encoding("br", ["identity", "gzip"])

    test
      .expect(result)
      .toEqual(["identity"])
  })

  test.it("handles complex accept-encoding header", () => {
    const result = ContentNegotiation.encoding(
      "gzip;q=1.0, identity;q=0.5, *;q=0",
      ["deflate", "gzip", "identity"],
    )

    test
      .expect(result)
      .toEqual(["gzip", "identity"])
  })

  test.it("returns all accepted encodings when available not provided", () => {
    const result = ContentNegotiation.encoding("gzip, deflate;q=0.8, br;q=0.5")

    test
      .expect(result)
      .toEqual(["gzip", "deflate", "br", "identity"])
  })

  test.it("returns empty array for empty accept-encoding header", () => {
    const result = ContentNegotiation.encoding("", ["gzip", "deflate"])

    test
      .expect(result)
      .toEqual([])
  })

  test.it("excludes identity when identity;q=0", () => {
    const result = ContentNegotiation.encoding(
      "gzip, identity;q=0",
      ["gzip", "identity"],
    )

    test
      .expect(result)
      .toEqual(["gzip"])
  })

  test.it("excludes unspecified encodings when *;q=0", () => {
    const result = ContentNegotiation.encoding(
      "gzip, *;q=0",
      ["gzip", "deflate", "br"],
    )

    test
      .expect(result)
      .toEqual(["gzip"])
  })
})

test.describe("ContentNegotiation.charset", () => {
  test.it("returns empty array when no charsets provided", () => {
    const result = ContentNegotiation.charset("utf-8", [])

    test
      .expect(result)
      .toEqual([])
  })

  test.it("returns matching charset", () => {
    const result = ContentNegotiation.charset(
      "iso-8859-1",
      ["utf-8", "iso-8859-1"],
    )

    test
      .expect(result)
      .toEqual(["iso-8859-1"])
  })

  test.it("returns charsets sorted by quality", () => {
    const result = ContentNegotiation.charset(
      "utf-8;q=0.5, iso-8859-1;q=0.9",
      ["utf-8", "iso-8859-1"],
    )

    test
      .expect(result)
      .toEqual(["iso-8859-1", "utf-8"])
  })

  test.it("returns empty array when no matching charset", () => {
    const result = ContentNegotiation.charset(
      "utf-16",
      ["utf-8", "iso-8859-1"],
    )

    test
      .expect(result)
      .toEqual([])
  })

  test.it("handles wildcard", () => {
    const result = ContentNegotiation.charset("*", ["utf-8", "iso-8859-1"])

    test
      .expect(result)
      .toEqual(["utf-8", "iso-8859-1"])
  })

  test.it("handles complex accept-charset header", () => {
    const result = ContentNegotiation.charset(
      "utf-8, iso-8859-1;q=0.8, utf-7;q=0.2",
      ["utf-7", "iso-8859-1", "utf-8"],
    )

    test
      .expect(result)
      .toEqual(["utf-8", "iso-8859-1", "utf-7"])
  })

  test.it("returns all accepted charsets when available not provided", () => {
    const result = ContentNegotiation.charset(
      "utf-8, iso-8859-1;q=0.8, utf-7;q=0.2",
    )

    test
      .expect(result)
      .toEqual(["utf-8", "iso-8859-1", "utf-7"])
  })

  test.it("returns empty array for empty accept-charset header", () => {
    const result = ContentNegotiation.charset("", ["utf-8", "iso-8859-1"])

    test
      .expect(result)
      .toEqual([])
  })

  test.it("matches case-insensitively", () => {
    const result = ContentNegotiation.charset("UTF-8", ["utf-8", "iso-8859-1"])

    test
      .expect(result)
      .toEqual(["utf-8"])
  })
})

test.describe("ContentNegotiation.headerMedia", () => {
  test.it("parses Accept header from Headers object", () => {
    const headers = new Headers({ accept: "text/html, application/json" })
    const result = ContentNegotiation.headerMedia(headers, [
      "text/html",
      "application/json",
    ])

    test
      .expect(result)
      .toEqual(["text/html", "application/json"])
  })

  test.it("returns empty array when Accept header is missing", () => {
    const headers = new Headers({})
    const result = ContentNegotiation.headerMedia(headers, ["text/html"])

    test
      .expect(result)
      .toEqual([])
  })
})

test.describe("ContentNegotiation.headerLanguage", () => {
  test.it("parses Accept-Language header from Headers object", () => {
    const headers = new Headers({ "accept-language": "en, fr;q=0.8" })
    const result = ContentNegotiation.headerLanguage(headers, ["en", "fr"])

    test
      .expect(result)
      .toEqual(["en", "fr"])
  })

  test.it("returns empty array when Accept-Language header is missing", () => {
    const headers = new Headers({})
    const result = ContentNegotiation.headerLanguage(headers, ["en"])

    test
      .expect(result)
      .toEqual([])
  })
})

test.describe("ContentNegotiation.headerEncoding", () => {
  test.it("parses Accept-Encoding header from Headers object", () => {
    const headers = new Headers({ "accept-encoding": "gzip, deflate" })
    const result = ContentNegotiation.headerEncoding(headers, [
      "gzip",
      "deflate",
    ])

    test
      .expect(result)
      .toEqual(["gzip", "deflate"])
  })

  test.it("returns empty array when Accept-Encoding header is missing", () => {
    const headers = new Headers({})
    const result = ContentNegotiation.headerEncoding(headers, ["gzip"])

    test
      .expect(result)
      .toEqual([])
  })
})

test.describe("ContentNegotiation.headerCharset", () => {
  test.it("parses Accept-Charset header from Headers object", () => {
    const headers = new Headers({ "accept-charset": "utf-8, iso-8859-1" })
    const result = ContentNegotiation.headerCharset(headers, [
      "utf-8",
      "iso-8859-1",
    ])

    test
      .expect(result)
      .toEqual(["utf-8", "iso-8859-1"])
  })

  test.it("returns empty array when Accept-Charset header is missing", () => {
    const headers = new Headers({})
    const result = ContentNegotiation.headerCharset(headers, ["utf-8"])

    test
      .expect(result)
      .toEqual([])
  })
})
