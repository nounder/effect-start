import * as test from "bun:test"
import { CliError } from "effect-start/cli"

test.describe("CliError", () => {
  test.it("isCliError", () => {
    const err = new CliError.CliError({ reason: "MissingOption", option: "test" })
    test.expect(CliError.isCliError(err)).toBe(true)
    test.expect(CliError.isCliError(new Error("not cli"))).toBe(false)
  })
})
