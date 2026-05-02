import * as test from "bun:test"
import * as Pretty from "../../src/studio/internal/Pretty.ts"

test.describe("Pretty", () => {
  test.it("formats structured log messages as pretty JSON blocks", () => {
    const message = Pretty.formatLogMessage([
      "[waitForStable]",
      {
        window: 0,
        count: 0,
        peak: 0,
        consecutiveLow: 0,
        done: false,
      },
    ])

    test.expect(message).toBe(`[waitForStable]
{
  "window": 0,
  "count": 0,
  "peak": 0,
  "consecutiveLow": 0,
  "done": false
}`)
  })
})
