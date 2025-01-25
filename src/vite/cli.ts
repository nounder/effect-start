import * as Cli from "@effect/cli"
import {
  FileSystem,
  HttpClient,
  HttpClientRequest,
  HttpClientResponse,
  Path,
} from "@effect/platform"
import { NodeContext } from "@effect/platform-node"
import {
  Chunk,
  Console,
  Duration,
  Effect,
  Either,
  flow,
  Layer,
  Option,
  pipe,
  Queue,
  Ref,
  Schema,
  Stream,
} from "effect"
import * as vite from "vite"
import process from "node:process"
import { createViteConfig } from "./config.ts"

async function build() {
  const config = await createViteConfig()

  const res = await vite.build({
    ...config,
  })

  return res
}

const root = pipe(
  Cli.Command.make("build", {}),
  Cli.Command.withHandler((args) =>
    Effect.gen(function* () {
      const output = yield* Effect.tryPromise(() => build())

      yield* Console.log(output)
    })
  ),
)

const main = Cli.Command.run(root, {
  name: "pad",
  version: "0.0.1",
})

if (import.meta.main) {
  Effect.runPromise(
    main(process.argv).pipe(
      Effect.provide(NodeContext.layer),
      Effect.catchAll((e) => Console.error(e.error)),
    ),
  )
}
