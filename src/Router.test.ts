import * as HttpServerResponse from "@effect/platform/HttpServerResponse"
import {
  expect,
  it,
  test,
} from "bun:test"
import * as Effect from "effect/Effect"
import * as Router from "./Router.ts"

test("Router Context Tag", () => {
  expect(Router.Router)
    .toBeDefined()
})

test("Router layer function", async () => {
  const mockManifest: Router.RouteManifest = {
    Pages: [],
    Layouts: [],
    Servers: [],
  }

  const loadFunction = () => Promise.resolve(mockManifest)
  const layer = Router.layer(loadFunction)

  expect(layer)
    .toBeDefined()

  const program = Effect.gen(function*() {
    const routerContext = yield* Router.Router
    return routerContext
  })

  const result = await Effect.runPromise(
    Effect.provide(program, layer),
  )

  expect(result.Pages)
    .toEqual(mockManifest.Pages)
  expect(result.Layouts)
    .toEqual(mockManifest.Layouts)
  expect(result.Servers)
    .toEqual(mockManifest.Servers)
  expect(result.httpRouter)
    .toBeDefined()
})

test("Router layer with import-style manifest", async () => {
  const mockImportedModule = {
    Pages: [{
      path: "/test" as const,
      load: () => Promise.resolve({ default: () => {} }),
    }],
    Layouts: [{
      path: "/layout" as const,
      load: () => Promise.resolve({ default: () => {} }),
    }],
    Servers: [{
      path: "/api" as const,
      load: () =>
        Promise.resolve({
          default: Effect.succeed(HttpServerResponse.empty()),
        }),
    }],
  }

  const loadFunction = () => Promise.resolve(mockImportedModule)
  const layer = Router.layer(loadFunction)

  const program = Effect.gen(function*() {
    const routerContext = yield* Router.Router
    return routerContext
  })

  const result = await Effect.runPromise(
    Effect.provide(program, layer),
  )

  expect(result.Pages)
    .toEqual(mockImportedModule.Pages)
  expect(result.Layouts)
    .toEqual(mockImportedModule.Layouts)
  expect(result.Servers)
    .toEqual(mockImportedModule.Servers)
  expect(result.httpRouter)
    .toBeDefined()
})
