import { describe, expect, test } from "bun:test"
import type { HTMLBundle } from "bun"
import * as BunRoute from "./BunRoute.ts"

describe("BunRoute", () => {
  test("load creates a BunRoute that is also a RouteSet", () => {
    const mockBundle = { default: {}, index: "" } as HTMLBundle
    const route = BunRoute.load(() => Promise.resolve({ default: mockBundle }))

    expect(BunRoute.isBunRoute(route)).toBe(true)
    expect(typeof route.loader).toBe("function")
    expect(route.set).toBeDefined()
    expect(Array.isArray(route.set)).toBe(true)
    expect(route.set.length).toBeGreaterThan(0)
  })

  test("isBunRoute returns false for non-BunRoute objects", () => {
    expect(BunRoute.isBunRoute({})).toBe(false)
    expect(BunRoute.isBunRoute(null)).toBe(false)
    expect(BunRoute.isBunRoute(undefined)).toBe(false)
    expect(BunRoute.isBunRoute("string")).toBe(false)
    expect(BunRoute.isBunRoute({ set: [] })).toBe(false)
  })

  test("loader function is callable", async () => {
    const mockBundle = { default: {}, index: "" } as HTMLBundle
    const route = BunRoute.load(() => Promise.resolve({ default: mockBundle }))
    const result = await route.loader()

    expect(result).toEqual({ default: mockBundle })
  })

  test("BunRoute has TypeId marker", () => {
    const mockBundle = { default: {}, index: "" } as HTMLBundle
    const route = BunRoute.load(() => Promise.resolve({ default: mockBundle }))

    expect(BunRoute.TypeId in route).toBe(true)
    expect(route[BunRoute.TypeId]).toBe(BunRoute.TypeId)
  })
})
