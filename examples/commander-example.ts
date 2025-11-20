import * as Console from "effect/Console"
import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"
import * as Commander from "../src/Commander.ts"

const unhandledFormat = Commander.make({
  name: "format",
  description: "Format source files"
})

const handledFormat = unhandledFormat
  .option("--style", "-s")
  .description("Code style to use")
  .default("standard")
  .schema(Commander.choice(["standard", "prettier", "biome"]))
  .handle((opts) => Console.log(`Formatting with style: ${opts.style}`))

const main = Commander
  .make({
    name: "main",
    description: "this is doing that",
    version: "1.0.0"
  })
  .option("--source", "-s")
  .schema(Schema.String)
  .option("--verbose", "-v")
  .description("Enable verbose output")
  .default(false)
  .schema(Commander.BooleanFromString)
  .optionHelp()
  .subcommand(handledFormat)
  .handle((opts) =>
    Effect.gen(function* () {
      yield* Console.log("Running main command")
      yield* Console.log(`Source: ${opts.source}`)
      yield* Console.log(`Verbose: ${opts.verbose}`)
      yield* Console.log(`Help: ${opts.help}`)
    })
  )

if (import.meta.main) {
  await Effect.runPromise(Commander.runMain(main))
}
