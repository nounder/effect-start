import * as Effect from "effect/Effect"
import type * as FileSystem from "effect/FileSystem"
import * as Function from "effect/Function"
import * as Logger from "effect/Logger"
import type * as PlatformError from "effect/PlatformError"
import type * as Scope from "effect/Scope"
import * as FileWriter from "./FileWriter.ts"

export const toFile: {
  (
    options: FileWriter.Options,
  ): <Message>(
    self: Logger.Logger<Message, string>,
  ) => Effect.Effect<
    Logger.Logger<Message, void>,
    PlatformError.PlatformError,
    Scope.Scope | FileSystem.FileSystem
  >
  <Message>(
    self: Logger.Logger<Message, string>,
    options: FileWriter.Options,
  ): Effect.Effect<
    Logger.Logger<Message, void>,
    PlatformError.PlatformError,
    Scope.Scope | FileSystem.FileSystem
  >
} = Function.dual(
  (args) => Logger.isLogger(args[0]),
  <Message>(
    self: Logger.Logger<Message, string>,
    options: FileWriter.Options,
  ) =>
    Effect.map(
      FileWriter.build({ ...options, batchWindow: options.batchWindow ?? 1000 }),
      (writer) => Logger.map(self, (output) => Effect.runSync(writer.append(output))),
    ),
)
