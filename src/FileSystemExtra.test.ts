import * as t from "bun:test"
import * as FileSystemExtra from "./FileSystemExtra.ts"

t.describe("filterSourceFiles", () => {
  t.it("returns true for TypeScript files", () => {
    t
      .expect(
        FileSystemExtra.filterSourceFiles({
          eventType: "change",
          filename: "file.ts",
          path: "/path/to/file.ts",
        }),
      )
      .toBe(true)

    t
      .expect(
        FileSystemExtra.filterSourceFiles({
          eventType: "change",
          filename: "file.tsx",
          path: "/path/to/file.tsx",
        }),
      )
      .toBe(true)
  })

  t.it("returns true for JavaScript files", () => {
    t
      .expect(
        FileSystemExtra.filterSourceFiles({
          eventType: "change",
          filename: "file.js",
          path: "/path/to/file.js",
        }),
      )
      .toBe(true)

    t
      .expect(
        FileSystemExtra.filterSourceFiles({
          eventType: "change",
          filename: "file.jsx",
          path: "/path/to/file.jsx",
        }),
      )
      .toBe(true)
  })

  t.it("returns true for HTML files", () => {
    t
      .expect(
        FileSystemExtra.filterSourceFiles({
          eventType: "change",
          filename: "file.html",
          path: "/path/to/file.html",
        }),
      )
      .toBe(true)
  })

  t.it("returns true for CSS files", () => {
    t
      .expect(
        FileSystemExtra.filterSourceFiles({
          eventType: "change",
          filename: "file.css",
          path: "/path/to/file.css",
        }),
      )
      .toBe(true)
  })

  t.it("returns true for JSON files", () => {
    t
      .expect(
        FileSystemExtra.filterSourceFiles({
          eventType: "change",
          filename: "file.json",
          path: "/path/to/file.json",
        }),
      )
      .toBe(true)
  })

  t.it("returns false for directories", () => {
    t
      .expect(
        FileSystemExtra.filterSourceFiles({
          eventType: "change",
          filename: "directory",
          path: "/path/to/directory/",
        }),
      )
      .toBe(false)
  })

  t.it("returns false for non-source files", () => {
    t
      .expect(
        FileSystemExtra.filterSourceFiles({
          eventType: "change",
          filename: "file.md",
          path: "/path/to/file.md",
        }),
      )
      .toBe(false)

    t
      .expect(
        FileSystemExtra.filterSourceFiles({
          eventType: "change",
          filename: "file.txt",
          path: "/path/to/file.txt",
        }),
      )
      .toBe(false)

    t
      .expect(
        FileSystemExtra.filterSourceFiles({
          eventType: "change",
          filename: "file.pdf",
          path: "/path/to/file.pdf",
        }),
      )
      .toBe(false)
  })

  t.it("handles files with multiple dots in name", () => {
    t
      .expect(
        FileSystemExtra.filterSourceFiles({
          eventType: "change",
          filename: "file.test.ts",
          path: "/path/to/file.test.ts",
        }),
      )
      .toBe(true)

    t
      .expect(
        FileSystemExtra.filterSourceFiles({
          eventType: "change",
          filename: "config.local.json",
          path: "/path/to/config.local.json",
        }),
      )
      .toBe(true)
  })
})

t.describe("filterDirectory", () => {
  t.it("returns true for paths ending with /", () => {
    t
      .expect(
        FileSystemExtra.filterDirectory({
          eventType: "rename",
          filename: "directory",
          path: "/path/to/directory/",
        }),
      )
      .toBe(true)

    t
      .expect(
        FileSystemExtra.filterDirectory({
          eventType: "rename",
          filename: "root",
          path: "/root/",
        }),
      )
      .toBe(true)
  })

  t.it("returns false for file paths", () => {
    t
      .expect(
        FileSystemExtra.filterDirectory({
          eventType: "change",
          filename: "file.ts",
          path: "/path/to/file.ts",
        }),
      )
      .toBe(false)

    t
      .expect(
        FileSystemExtra.filterDirectory({
          eventType: "change",
          filename: "file",
          path: "/path/to/file",
        }),
      )
      .toBe(false)
  })
})

t.describe("WatchEvent type", () => {
  t.it("has correct eventType values", () => {
    const changeEvent: FileSystemExtra.WatchEvent = {
      eventType: "change",
      filename: "test.ts",
      path: "/test/path",
    }

    const renameEvent: FileSystemExtra.WatchEvent = {
      eventType: "rename",
      filename: "test.ts",
      path: "/test/path",
    }

    t
      .expect(changeEvent.eventType)
      .toBe("change")

    t
      .expect(renameEvent.eventType)
      .toBe("rename")
  })

  t.it("includes filename field", () => {
    const event: FileSystemExtra.WatchEvent = {
      eventType: "change",
      filename: "test.ts",
      path: "/test/path/test.ts",
    }

    t
      .expect(event.filename)
      .toBe("test.ts")

    t
      .expect(event.path)
      .toBe("/test/path/test.ts")
  })
})
