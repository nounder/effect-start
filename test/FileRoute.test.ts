import * as test from "bun:test"
import * as Fetch from "effect-start/Fetch"
import * as FileRoute from "effect-start/FileRoute"
import * as FileSystem from "effect-start/FileSystem"
import { NodeFileSystem } from "effect-start/node"
import * as Route from "effect-start/Route"
import * as RouteHttp from "effect-start/RouteHttp"
import * as Effect from "effect/Effect"
import * as NPath from "node:path"
import * as NUrl from "node:url"

test.it("renders a directory index as JSON and HTML and serves its files", () =>
  Effect
    .gen(function*() {
      const fs = yield* FileSystem.FileSystem
      const directory = yield* fs.makeTempDirectoryScoped()
      yield* fs.makeDirectory(NPath.join(directory, "nested"))
      yield* fs.writeFileString(NPath.join(directory, "hello.txt"), "hello")

      const runtime = yield* Effect.runtime<FileSystem.FileSystem>()
      const routes = Route.map({
        "/files/:path*": FileRoute.from({ path: directory, directoryIndex: true }),
        "/private/:path*": FileRoute.from({ path: directory, directoryIndex: false }),
      })
      const handles = Object.fromEntries(RouteHttp.walkHandles(routes, runtime))
      const client = Fetch.fromHandler(handles["/files/:path*"])

      const json = yield* client.get("http://localhost/files", {
        headers: { accept: "application/json" },
      })

      test
        .expect(json.status)
        .toBe(200)
      test
        .expect(json.headers.vary)
        .toBe("Accept")
      test
        .expect(yield* json.json)
        .toEqual({
          path: "/",
          files: [{
            name: "hello.txt",
            size: 5,
            type: "text/plain",
            lastModified: test.expect.any(Number),
          }],
        })

      const html = yield* client.get("http://localhost/files", {
        headers: { accept: "text/html" },
      })

      test
        .expect(html.headers["content-type"])
        .toBe("text/html; charset=utf-8")
      test
        .expect(yield* html.text)
        .toContain("hello.txt")

      const file = yield* client.get("http://localhost/files/hello.txt")
      const etag = file.headers.etag
      const lastModified = file.headers["last-modified"]
      if (typeof etag !== "string" || typeof lastModified !== "string") {
        throw new Error("expected file validators")
      }

      test
        .expect(file.headers["content-type"])
        .toBe("text/plain; charset=utf-8")
      test
        .expect(file.headers["accept-ranges"])
        .toBe("bytes")
      test
        .expect(file.headers.etag)
        .toMatch(/^"[0-9a-f]+-[0-9a-f]+"$/)
      test
        .expect(yield* file.text)
        .toBe("hello")

      const notModifiedByEtag = yield* client.get("http://localhost/files/hello.txt", {
        headers: { "if-none-match": etag },
      })
      const notModifiedByDate = yield* client.get("http://localhost/files/hello.txt", {
        headers: { "if-modified-since": lastModified },
      })
      const failedPrecondition = yield* client.get("http://localhost/files/hello.txt", {
        headers: { "if-match": "\"stale\"" },
      })

      test
        .expect(notModifiedByEtag.status)
        .toBe(304)
      test
        .expect(notModifiedByDate.status)
        .toBe(304)
      test
        .expect(failedPrecondition.status)
        .toBe(412)

      const range = yield* client.get("http://localhost/files/hello.txt", {
        headers: { range: "bytes=1-3" },
      })
      const suffixRange = yield* client.get("http://localhost/files/hello.txt", {
        headers: { range: "bytes=-2" },
      })
      const unsatisfiableRange = yield* client.get("http://localhost/files/hello.txt", {
        headers: { range: "bytes=10-20" },
      })
      const staleRange = yield* client.get("http://localhost/files/hello.txt", {
        headers: {
          range: "bytes=1-3",
          "if-range": "\"stale\"",
        },
      })

      test
        .expect(range.status)
        .toBe(206)
      test
        .expect(range.headers["content-range"])
        .toBe("bytes 1-3/5")
      test
        .expect(yield* range.text)
        .toBe("ell")
      test
        .expect(yield* suffixRange.text)
        .toBe("lo")
      test
        .expect(unsatisfiableRange.status)
        .toBe(416)
      test
        .expect(unsatisfiableRange.headers["content-range"])
        .toBe("bytes */5")
      test
        .expect(staleRange.status)
        .toBe(200)
      test
        .expect(yield* staleRange.text)
        .toBe("hello")

      const textFile = yield* client.get("http://localhost/files/hello.txt", {
        headers: { accept: "text/*" },
      })
      const fileWithUnrelatedAccept = yield* client.get("http://localhost/files/hello.txt", {
        headers: { accept: "application/json" },
      })

      test
        .expect(textFile.status)
        .toBe(200)
      test
        .expect(fileWithUnrelatedAccept.status)
        .toBe(200)

      const unsupportedIndex = yield* client.get("http://localhost/files", {
        headers: { accept: "image/png" },
      })

      test
        .expect(unsupportedIndex.status)
        .toBe(406)

      const missing = yield* client.get("http://localhost/files/missing.txt")

      test
        .expect(missing.status)
        .toBe(404)

      const privateClient = Fetch.fromHandler(handles["/private/:path*"])
      const privateIndex = yield* privateClient.get("http://localhost/private")
      const privateFile = yield* privateClient.get("http://localhost/private/hello.txt")

      test
        .expect(privateIndex.status)
        .toBe(404)
      test
        .expect(yield* privateFile.text)
        .toBe("hello")
    })
    .pipe(
      Effect.scoped,
      Effect.provide(NodeFileSystem.layer),
      Effect.runPromise,
    ))

test.it("serves a single file from a file URL on a rest path route", () =>
  Effect
    .gen(function*() {
      const fs = yield* FileSystem.FileSystem
      const directory = yield* fs.makeTempDirectoryScoped()
      const path = NPath.join(directory, "data.json")
      yield* fs.writeFileString(path, "{\"ok\":true}")

      const runtime = yield* Effect.runtime<FileSystem.FileSystem>()
      const routes = Route.map({
        "/download/:path*": FileRoute.from({
          path: NUrl.pathToFileURL(path),
          directoryIndex: false,
        }),
      })
      const handles = Object.fromEntries(RouteHttp.walkHandles(routes, runtime))
      const client = Fetch.fromHandler(handles["/download/:path*"])

      const file = yield* client.get("http://localhost/download", {
        headers: { accept: "application/json" },
      })

      test
        .expect(file.status)
        .toBe(200)
      test
        .expect(file.headers["content-type"])
        .toBe("application/json")
      test
        .expect(yield* file.text)
        .toBe("{\"ok\":true}")

      const rest = yield* client.get("http://localhost/download/other")

      test
        .expect(rest.status)
        .toBe(404)
    })
    .pipe(
      Effect.scoped,
      Effect.provide(NodeFileSystem.layer),
      Effect.runPromise,
    ))
