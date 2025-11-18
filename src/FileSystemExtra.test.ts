import * as t from "bun:test"
import * as FileSystemExtra from "./FileSystemExtra.ts"

t.describe("filterSourceFiles", () => {
  t.it("returns true for TypeScript files", () => {
    t
      .expect(
        FileSystemExtra.filterSourceFiles({
          _tag: "change",
          path: "/path/to/file.ts",
        }),
      )
      .toBe(true)

    t
      .expect(
        FileSystemExtra.filterSourceFiles({
          _tag: "change",
          path: "/path/to/file.tsx",
        }),
      )
      .toBe(true)
  })

  t.it("returns true for JavaScript files", () => {
    t
      .expect(
        FileSystemExtra.filterSourceFiles({
          _tag: "change",
          path: "/path/to/file.js",
        }),
      )
      .toBe(true)

    t
      .expect(
        FileSystemExtra.filterSourceFiles({
          _tag: "change",
          path: "/path/to/file.jsx",
        }),
      )
      .toBe(true)
  })

  t.it("returns true for HTML files", () => {
    t
      .expect(
        FileSystemExtra.filterSourceFiles({
          _tag: "change",
          path: "/path/to/file.html",
        }),
      )
      .toBe(true)
  })

  t.it("returns true for CSS files", () => {
    t
      .expect(
        FileSystemExtra.filterSourceFiles({
          _tag: "change",
          path: "/path/to/file.css",
        }),
      )
      .toBe(true)
  })

  t.it("returns true for JSON files", () => {
    t
      .expect(
        FileSystemExtra.filterSourceFiles({
          _tag: "change",
          path: "/path/to/file.json",
        }),
      )
      .toBe(true)
  })

  t.it("returns false for directories", () => {
    t
      .expect(
        FileSystemExtra.filterSourceFiles({
          _tag: "change",
          path: "/path/to/directory/",
        }),
      )
      .toBe(false)
  })

  t.it("returns false for non-source files", () => {
    t
      .expect(
        FileSystemExtra.filterSourceFiles({
          _tag: "change",
          path: "/path/to/file.md",
        }),
      )
      .toBe(false)

    t
      .expect(
        FileSystemExtra.filterSourceFiles({
          _tag: "change",
          path: "/path/to/file.txt",
        }),
      )
      .toBe(false)

    t
      .expect(
        FileSystemExtra.filterSourceFiles({
          _tag: "change",
          path: "/path/to/file.pdf",
        }),
      )
      .toBe(false)
  })

  t.it("handles files with multiple dots in name", () => {
    t
      .expect(
        FileSystemExtra.filterSourceFiles({
          _tag: "change",
          path: "/path/to/file.test.ts",
        }),
      )
      .toBe(true)

    t
      .expect(
        FileSystemExtra.filterSourceFiles({
          _tag: "change",
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
          _tag: "rename",
          path: "/path/to/directory/",
        }),
      )
      .toBe(true)

    t
      .expect(
        FileSystemExtra.filterDirectory({
          _tag: "rename",
          path: "/root/",
        }),
      )
      .toBe(true)
  })

  t.it("returns false for file paths", () => {
    t
      .expect(
        FileSystemExtra.filterDirectory({
          _tag: "change",
          path: "/path/to/file.ts",
        }),
      )
      .toBe(false)

    t
      .expect(
        FileSystemExtra.filterDirectory({
          _tag: "change",
          path: "/path/to/file",
        }),
      )
      .toBe(false)
  })
})

t.describe("WatchEvent type", () => {
  t.it("has correct _tag values", () => {
    const changeEvent: FileSystemExtra.WatchEvent = {
      _tag: "change",
      path: "/test/path",
    }

    const renameEvent: FileSystemExtra.WatchEvent = {
      _tag: "rename",
      path: "/test/path",
    }

    t
      .expect(changeEvent._tag)
      .toBe("change")

    t
      .expect(renameEvent._tag)
      .toBe("rename")
  })
})
