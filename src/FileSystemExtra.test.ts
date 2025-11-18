import * as t from "bun:test"
import * as FileSystemExtra from "./FileSystemExtra.ts"

t.describe("filterSourceFiles", () => {
  t.it("returns true for TypeScript files", () => {
    t
      .expect(
        FileSystemExtra.filterSourceFiles({
          eventType: "change",
          filename: "test.ts",
          path: "/path/to/test.ts",
        }),
      )
      .toBe(true)

    t
      .expect(
        FileSystemExtra.filterSourceFiles({
          eventType: "change",
          filename: "test.tsx",
          path: "/path/to/test.tsx",
        }),
      )
      .toBe(true)
  })

  t.it("returns true for JavaScript files", () => {
    t
      .expect(
        FileSystemExtra.filterSourceFiles({
          eventType: "change",
          filename: "test.js",
          path: "/path/to/test.js",
        }),
      )
      .toBe(true)

    t
      .expect(
        FileSystemExtra.filterSourceFiles({
          eventType: "change",
          filename: "test.jsx",
          path: "/path/to/test.jsx",
        }),
      )
      .toBe(true)
  })

  t.it("returns true for HTML and CSS files", () => {
    t
      .expect(
        FileSystemExtra.filterSourceFiles({
          eventType: "change",
          filename: "index.html",
          path: "/path/to/index.html",
        }),
      )
      .toBe(true)

    t
      .expect(
        FileSystemExtra.filterSourceFiles({
          eventType: "change",
          filename: "styles.css",
          path: "/path/to/styles.css",
        }),
      )
      .toBe(true)
  })

  t.it("returns true for JSON files", () => {
    t
      .expect(
        FileSystemExtra.filterSourceFiles({
          eventType: "change",
          filename: "config.json",
          path: "/path/to/config.json",
        }),
      )
      .toBe(true)
  })

  t.it("returns false for non-source files", () => {
    t
      .expect(
        FileSystemExtra.filterSourceFiles({
          eventType: "change",
          filename: "README.md",
          path: "/path/to/README.md",
        }),
      )
      .toBe(false)

    t
      .expect(
        FileSystemExtra.filterSourceFiles({
          eventType: "change",
          filename: "document.txt",
          path: "/path/to/document.txt",
        }),
      )
      .toBe(false)

    t
      .expect(
        FileSystemExtra.filterSourceFiles({
          eventType: "change",
          filename: "image.png",
          path: "/path/to/image.png",
        }),
      )
      .toBe(false)
  })

  t.it("returns false for directories", () => {
    t
      .expect(
        FileSystemExtra.filterSourceFiles({
          eventType: "rename",
          filename: "src",
          path: "/path/to/src/",
        }),
      )
      .toBe(false)
  })

  t.it("handles files with multiple dots", () => {
    t
      .expect(
        FileSystemExtra.filterSourceFiles({
          eventType: "change",
          filename: "component.test.ts",
          path: "/path/to/component.test.ts",
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
          filename: "src",
          path: "/path/to/src/",
        }),
      )
      .toBe(true)

    t
      .expect(
        FileSystemExtra.filterDirectory({
          eventType: "rename",
          filename: "node_modules",
          path: "/project/node_modules/",
        }),
      )
      .toBe(true)
  })

  t.it("returns false for file paths", () => {
    t
      .expect(
        FileSystemExtra.filterDirectory({
          eventType: "change",
          filename: "index.ts",
          path: "/path/to/index.ts",
        }),
      )
      .toBe(false)

    t
      .expect(
        FileSystemExtra.filterDirectory({
          eventType: "change",
          filename: "README",
          path: "/path/to/README",
        }),
      )
      .toBe(false)
  })
})

t.describe("WatchEvent type", () => {
  t.it("has correct structure", () => {
    const changeEvent: FileSystemExtra.WatchEvent = {
      eventType: "change",
      filename: "test.ts",
      path: "/path/to/test.ts",
    }

    const renameEvent: FileSystemExtra.WatchEvent = {
      eventType: "rename",
      filename: "moved.js",
      path: "/new/path/moved.js",
    }

    t
      .expect(changeEvent.eventType)
      .toBe("change")

    t
      .expect(changeEvent.filename)
      .toBe("test.ts")

    t
      .expect(changeEvent.path)
      .toBe("/path/to/test.ts")

    t
      .expect(renameEvent.eventType)
      .toBe("rename")

    t
      .expect(renameEvent.filename)
      .toBe("moved.js")
  })
})

