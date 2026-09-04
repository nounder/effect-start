import * as test from "bun:test"
import * as Pretty from "effect-start/studio/internal/Pretty"

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

    test
      .expect(message)
      .toBe(`[waitForStable]
{
  "window": 0,
  "count": 0,
  "peak": 0,
  "consecutiveLow": 0,
  "done": false
}`)
  })
})
