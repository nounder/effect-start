import * as test from "bun:test"
import { CliError, isCliError } from "./CliError.ts"

test.describe("CliError", () => {
  test.it("isCliError", () => {
    const err = new CliError({ reason: "MissingOption", option: "test" })
    test.expect(isCliError(err)).toBe(true)
    test.expect(isCliError(new Error("not cli"))).toBe(false)
  })
})
