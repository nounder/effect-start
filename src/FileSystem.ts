/*
 * Adapted from @effect/platform
 */
import * as Brand from "effect/Brand"
import * as Channel from "effect/Channel"
import * as Chunk from "effect/Chunk"
import * as Context from "effect/Context"
import * as Data from "effect/Data"
import * as Effect from "effect/Effect"
import * as Function from "effect/Function"
import * as Option from "effect/Option"
import * as Sink from "effect/Sink"
import type * as Scope from "effect/Scope"
import * as Stream from "effect/Stream"
import * as System from "./System.ts"

export interface FileSystem {
  readonly access: (
    path: string,
    options?: AccessFileOptions,
  ) => Effect.Effect<void, System.SystemError>
  readonly copy: (
    fromPath: string,
    toPath: string,
    options?: CopyOptions,
  ) => Effect.Effect<void, System.SystemError>
  readonly copyFile: (fromPath: string, toPath: string) => Effect.Effect<void, System.SystemError>
  readonly chmod: (path: string, mode: number) => Effect.Effect<void, System.SystemError>
  readonly chown: (
    path: string,
    uid: number,
    gid: number,
  ) => Effect.Effect<void, System.SystemError>
  readonly exists: (path: string) => Effect.Effect<boolean, System.SystemError>
  readonly link: (fromPath: string, toPath: string) => Effect.Effect<void, System.SystemError>
  readonly makeDirectory: (
    path: string,
    options?: MakeDirectoryOptions,
  ) => Effect.Effect<void, System.SystemError>
  readonly makeTempDirectory: (
    options?: MakeTempDirectoryOptions,
  ) => Effect.Effect<string, System.SystemError>
  readonly makeTempDirectoryScoped: (
    options?: MakeTempDirectoryOptions,
  ) => Effect.Effect<string, System.SystemError, Scope.Scope>
  readonly makeTempFile: (
    options?: MakeTempFileOptions,
  ) => Effect.Effect<string, System.SystemError>
  readonly makeTempFileScoped: (
    options?: MakeTempFileOptions,
  ) => Effect.Effect<string, System.SystemError, Scope.Scope>
  readonly open: (
    path: string,
    options?: OpenFileOptions,
  ) => Effect.Effect<File, System.SystemError, Scope.Scope>
  readonly readDirectory: (
    path: string,
    options?: ReadDirectoryOptions,
  ) => Effect.Effect<Array<string>, System.SystemError>
  readonly readFile: (path: string) => Effect.Effect<Uint8Array, System.SystemError>
  readonly readFileString: (
    path: string,
    encoding?: string,
  ) => Effect.Effect<string, System.SystemError>
  readonly readLink: (path: string) => Effect.Effect<string, System.SystemError>
  readonly realPath: (path: string) => Effect.Effect<string, System.SystemError>
  readonly remove: (
    path: string,
    options?: RemoveOptions,
  ) => Effect.Effect<void, System.SystemError>
  readonly rename: (oldPath: string, newPath: string) => Effect.Effect<void, System.SystemError>
  readonly sink: (
    path: string,
    options?: SinkOptions,
  ) => Sink.Sink<void, Uint8Array, never, System.SystemError>
  readonly stat: (path: string) => Effect.Effect<File.Info, System.SystemError>
  readonly stream: (
    path: string,
    options?: StreamOptions,
  ) => Stream.Stream<Uint8Array, System.SystemError>
  readonly symlink: (fromPath: string, toPath: string) => Effect.Effect<void, System.SystemError>
  readonly truncate: (path: string, length?: SizeInput) => Effect.Effect<void, System.SystemError>
  readonly utimes: (
    path: string,
    atime: Date | number,
    mtime: Date | number,
  ) => Effect.Effect<void, System.SystemError>
  readonly watch: (
    path: string,
    options?: WatchOptions,
  ) => Stream.Stream<WatchEvent, System.SystemError>
  readonly writeFile: (
    path: string,
    data: Uint8Array,
    options?: WriteFileOptions,
  ) => Effect.Effect<void, System.SystemError>
  readonly writeFileString: (
    path: string,
    data: string,
    options?: WriteFileStringOptions,
  ) => Effect.Effect<void, System.SystemError>
}

export const FileSystem: Context.Tag<FileSystem, FileSystem> = Context.GenericTag<FileSystem>(
  "@effect/platform/FileSystem",
)

export type Size = Brand.Branded<bigint, "Size">

export type SizeInput = bigint | number | Size

export const Size = (bytes: SizeInput): Size =>
  typeof bytes === "bigint" ? (bytes as Size) : (BigInt(bytes) as Size)

export type OpenFlag = "r" | "r+" | "w" | "wx" | "w+" | "wx+" | "a" | "ax" | "a+" | "ax+"

export type SeekMode = "start" | "current"

export interface AccessFileOptions {
  readonly ok?: boolean
  readonly readable?: boolean
  readonly writable?: boolean
}

export interface MakeDirectoryOptions {
  readonly recursive?: boolean
  readonly mode?: number
}

export interface CopyOptions {
  readonly overwrite?: boolean
  readonly preserveTimestamps?: boolean
}

export interface MakeTempDirectoryOptions {
  readonly directory?: string
  readonly prefix?: string
}

export interface MakeTempFileOptions {
  readonly directory?: string
  readonly prefix?: string
  readonly suffix?: string
}

export interface OpenFileOptions {
  readonly flag?: OpenFlag
  readonly mode?: number
}

export interface ReadDirectoryOptions {
  readonly recursive?: boolean
}

export interface RemoveOptions {
  readonly recursive?: boolean
  readonly force?: boolean
}

export interface SinkOptions extends OpenFileOptions {}

export interface StreamOptions {
  readonly bufferSize?: number
  readonly bytesToRead?: SizeInput
  readonly chunkSize?: SizeInput
  readonly offset?: SizeInput
}

export interface WriteFileOptions {
  readonly flag?: OpenFlag
  readonly mode?: number
}

export interface WriteFileStringOptions {
  readonly flag?: OpenFlag
  readonly mode?: number
}

export interface WatchOptions {
  readonly recursive?: boolean
}

export const FileTypeId: unique symbol = Symbol.for("@effect/platform/FileSystem/File")

export type FileTypeId = typeof FileTypeId

export interface File {
  readonly [FileTypeId]: FileTypeId
  readonly fd: File.Descriptor
  readonly stat: Effect.Effect<File.Info, System.SystemError>
  readonly seek: (offset: SizeInput, from: SeekMode) => Effect.Effect<void>
  readonly sync: Effect.Effect<void, System.SystemError>
  readonly read: (buffer: Uint8Array) => Effect.Effect<Size, System.SystemError>
  readonly readAlloc: (
    size: SizeInput,
  ) => Effect.Effect<Option.Option<Uint8Array>, System.SystemError>
  readonly truncate: (length?: SizeInput) => Effect.Effect<void, System.SystemError>
  readonly write: (buffer: Uint8Array) => Effect.Effect<Size, System.SystemError>
  readonly writeAll: (buffer: Uint8Array) => Effect.Effect<void, System.SystemError>
}

export declare namespace File {
  export type Descriptor = Brand.Branded<number, "FileDescriptor">

  export type Type =
    | "File"
    | "Directory"
    | "SymbolicLink"
    | "BlockDevice"
    | "CharacterDevice"
    | "FIFO"
    | "Socket"
    | "Unknown"

  export interface Info {
    readonly type: Type
    readonly mtime: Option.Option<Date>
    readonly atime: Option.Option<Date>
    readonly birthtime: Option.Option<Date>
    readonly dev: number
    readonly ino: Option.Option<number>
    readonly mode: number
    readonly nlink: Option.Option<number>
    readonly uid: Option.Option<number>
    readonly gid: Option.Option<number>
    readonly rdev: Option.Option<number>
    readonly size: Size
    readonly blksize: Option.Option<Size>
    readonly blocks: Option.Option<number>
  }
}

export const FileDescriptor = Brand.nominal<File.Descriptor>()

export type WatchEvent = WatchEvent.Create | WatchEvent.Update | WatchEvent.Remove

export declare namespace WatchEvent {
  export interface Create {
    readonly _tag: "Create"
    readonly path: string
  }

  export interface Update {
    readonly _tag: "Update"
    readonly path: string
  }

  export interface Remove {
    readonly _tag: "Remove"
    readonly path: string
  }
}

export const WatchEventCreate: Data.Case.Constructor<WatchEvent.Create, "_tag"> =
  Data.tagged<WatchEvent.Create>("Create")

export const WatchEventUpdate: Data.Case.Constructor<WatchEvent.Update, "_tag"> =
  Data.tagged<WatchEvent.Update>("Update")

export const WatchEventRemove: Data.Case.Constructor<WatchEvent.Remove, "_tag"> =
  Data.tagged<WatchEvent.Remove>("Remove")

export class WatchBackend extends Context.Tag("@effect/platform/FileSystem/WatchBackend")<
  WatchBackend,
  {
    readonly register: (
      path: string,
      stat: File.Info,
      options?: WatchOptions,
    ) => Option.Option<Stream.Stream<WatchEvent, System.SystemError>>
  }
>() {}

export const make = (
  impl: Omit<FileSystem, "exists" | "readFileString" | "stream" | "sink" | "writeFileString">,
): FileSystem => {
  return FileSystem.of({
    ...impl,
    exists: (path) =>
      Function.pipe(
        impl.access(path),
        Effect.as(true),
        Effect.catchTag("SystemError", (e) =>
          e.reason === "NotFound" ? Effect.succeed(false) : Effect.fail(e),
        ),
      ),
    readFileString: (path, encoding) =>
      Effect.tryMap(impl.readFile(path), {
        try: (_) => new TextDecoder(encoding).decode(_),
        catch: (cause) =>
          new System.SystemError({
            reason: "BadArgument",
            module: "FileSystem",
            method: "readFileString",
            description: "invalid encoding",
            cause,
          }),
      }),
    stream: (path, options) =>
      Function.pipe(
        impl.open(path, { flag: "r" }),
        options?.offset
          ? Effect.tap((file) => file.seek(options.offset!, "start"))
          : Function.identity,
        Effect.map((file) => fileStream(file, options)),
        Stream.unwrapScoped,
      ),
    sink: (path, options) =>
      Function.pipe(
        impl.open(path, { flag: "w", ...options }),
        Effect.map((file) => Sink.forEach((_: Uint8Array) => file.writeAll(_))),
        Sink.unwrapScoped,
      ),
    writeFileString: (path, data, options) =>
      Effect.flatMap(
        Effect.try({
          try: () => new TextEncoder().encode(data),
          catch: (cause) =>
            new System.SystemError({
              reason: "BadArgument",
              module: "FileSystem",
              method: "writeFileString",
              description: "could not encode string",
              cause,
            }),
        }),
        (_) => impl.writeFile(path, _, options),
      ),
  })
}

const fileStream = (file: File, options: StreamOptions = {}) => {
  const bytesToRead = options.bytesToRead !== undefined ? Size(options.bytesToRead) : undefined
  const chunkSize = Size(options.chunkSize ?? 64 * 1024)

  function loop(
    totalBytesRead: bigint,
  ): Channel.Channel<Chunk.Chunk<Uint8Array>, unknown, System.SystemError, unknown, void, unknown> {
    if (bytesToRead !== undefined && bytesToRead <= totalBytesRead) {
      return Channel.void
    }

    const toRead =
      bytesToRead !== undefined && bytesToRead - totalBytesRead < chunkSize
        ? bytesToRead - totalBytesRead
        : chunkSize

    return Channel.flatMap(
      file.readAlloc(toRead),
      Option.match({
        onNone: () => Channel.void,
        onSome: (buf) =>
          Channel.flatMap(Channel.write(Chunk.of(buf)), () =>
            loop(totalBytesRead + BigInt(buf.length)),
          ),
      }),
    )
  }

  return Stream.bufferChunks(Stream.fromChannel(loop(BigInt(0))), {
    capacity: options.bufferSize ?? 16,
  })
}
