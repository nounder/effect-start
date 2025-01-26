#!/usr/bin/env deno run --inspect -A

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
import * as path from "jsr:@std/path"
import process from "node:process"

const root = pipe(
  Cli.Command.make("run", {
    script: pipe(
      Cli.Options.file("script"),
      Cli.Options.withAlias("s"),
    ),
  }),
  Cli.Command.withHandler((args) =>
    Effect.gen(function*() {
      const countRef = yield* Ref.make(0)
      const fs = yield* FileSystem.FileSystem
      const scriptAbsPath = yield* fs.realPath(args.script)

      const queue = yield* Queue.unbounded()
      queue.unsafeOffer(undefined)

      yield* pipe(
        fs.watch(scriptAbsPath),
        Stream.throttle({
          cost: Chunk.size,
          duration: "100 millis",
          units: 1,
          // discard excdeeded events
          strategy: "enforce",
        }),
        Stream.runIntoQueue(queue),
        Effect.fork,
      )

      yield* pipe(
        Stream.fromQueue(queue),
        Stream.mapEffect((_) =>
          Effect.tryPromise(
            async () => {
              console.log(`Importing ${scriptAbsPath}`)

              const mod = await import(`${scriptAbsPath}?t=${Date.now()}`) as {
                default?: Effect.Effect<unknown>
              }

              return mod
            },
          )
        ),
        Stream.mapEffect((mod) => {
          const runEffect = (effect) => {
            return Effect.runPromise(effect.pipe(Effect.scoped))
              .catch(console.error)
          }

          Object.assign(globalThis, {
            HttpClient,
            HttpClientRequest,
            HttpClientResponse,
            Effect,
            Chunk,
            Console,
            Duration,
            Layer,
            Either,
            Option,
            pipe,
            flow,
            Queue,
            Stream,
            Schema,

            runEffect,

            ...Object.fromEntries(
              Object.entries(mod)
                .filter(([k]) => k !== "default"),
            ),
          })

          // map all effects
          Promise.all(
            Object.entries(mod)
              .filter(([k]) => k !== "default")
              .filter(([, v]) => Effect.isEffect(v))
              .map(([k, v]) => runEffect(v).then((v_) => [`${k}_`, v_])),
          ).then((entries) => {
            Object.assign(globalThis, Object.fromEntries(entries))
          })

          // make effects awaitable
          Object.assign(
            Object.getPrototypeOf(Effect.gen(function*() {})),
            {
              then(onfulfilled, onrejected) {
                return runEffect(this).then(onfulfilled, onrejected)
              },
            },
          )

          // run effect
          return pipe(
            Effect.gen(function*() {
              const run = yield* Ref.updateAndGet(countRef, (v) => v + 1)

              yield* Console.group({
                label: `Run ${run}`,
              })

              if (Effect.isEffect(mod.default)) {
                yield* mod.default!
              }
            }),
            Effect.scoped,
          ).pipe(
            Effect.catchAll(Console.error),
          )
        }),
        Stream.runDrain,
      )
    })
  ),
)

const main = Cli.Command.run(root, {
  name: "pad",
  version: "0.0.1",
})

await Effect.runPromise(
  main(process.argv).pipe(
    Effect.provide(NodeContext.layer),
  ),
)
