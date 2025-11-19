import { describe, expect, test } from "bun:test"
import * as BunRoute from "./BunRoute.ts"

describe("BunRoute", () => {
  test("load creates a BunRoute", () => {
    const route = BunRoute.load(() => import("./BunRoute.ts"))
    
    expect(BunRoute.isBunRoute(route)).toBe(true)
    expect(route._tag).toBe("BunRoute")
    expect(typeof route.load).toBe("function")
  })

  test("isBunRoute returns false for non-BunRoute objects", () => {
    expect(BunRoute.isBunRoute({})).toBe(false)
    expect(BunRoute.isBunRoute(null)).toBe(false)
    expect(BunRoute.isBunRoute(undefined)).toBe(false)
    expect(BunRoute.isBunRoute("string")).toBe(false)
    expect(BunRoute.isBunRoute({ _tag: "BunRoute" })).toBe(false)
  })

  test("load function is callable", async () => {
    const route = BunRoute.load(() => Promise.resolve({ default: "test" }))
    const result = await route.load()
    
    expect(result).toEqual({ default: "test" })
  })
})
