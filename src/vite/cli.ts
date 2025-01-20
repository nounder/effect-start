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
import { createViteConfig } from "../vite/dev.ts"

async function build() {
  const config = await createViteConfig()

  const res = await vite.build({
    ...config,
    publicDir: false,
    build: {
      manifest: true,
      rollupOptions: {
        input: Deno.cwd() + "/src/entry-client.tsx",
      },
    },
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
    ),
  )
}
