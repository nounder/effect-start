import { HttpClient, HttpClientResponse } from "@effect/platform"
import { fileURLToPath } from "bun"
import { SolidPlugin } from "bun-plugin-solid"
import { expect, it } from "bun:test"
import { Effect } from "effect"
import packageJson from "../package.json" with { type: "json" }
import * as BunBundle from "./bun/BunBundle.ts"
import * as TestHttpClient from "./effect/TestHttpClient.ts"
import { effectFn } from "./test.ts"

const effect = effectFn()

const SsrAppBundle = BunBundle.load<typeof import("./ssr.tsx")>({
  entrypoints: [
    fileURLToPath(import.meta.resolve("./ssr.tsx")),
  ],
  target: "bun",
  conditions: [
    "solid",
  ],
  sourcemap: "inline",
  packages: "bundle",
  external: [
    // externalize everything except solid because it requires
    // different resolve conditions
    ...Object.keys(packageJson.dependencies)
      .filter((v) => v !== "solid-js" && v !== "@solidjs/router")
      .flatMap((v) => [v, v + "/*"]),
  ],
  plugins: [
    SolidPlugin({
      generate: "ssr",
      hydratable: false,
    }),
  ],
}).pipe(
  Effect.andThen((v) => v.SsrApp),
  Effect.cached,
  Effect.flatten,
)

const Client = TestHttpClient.make(SsrAppBundle)

it("root", () =>
  effect(function*() {
    const res = yield* Client.get("/")

    expect(res.status).toEqual(200)
    expect(yield* res.text).toInclude(">Random<")
  }))

it("/random", () =>
  effect(function*() {
    const res = yield* Client.get("/random")

    expect(res.status).toEqual(200)
    expect(yield* res.text).toInclude("<h1 ")
  }))

it("404", () =>
  effect(function*() {
    const res = yield* Client.get("/not-found")

    console.log(yield* res.text)

    expect(res.status).toEqual(404)
  }))
