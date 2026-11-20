import * as Crypto from "node:crypto"
import * as NFS from "node:fs"
import * as OS from "node:os"
import * as Path from "node:path"
/** Ported from effect@4.0.0-rc.112. */
import * as BigInt from "effect/BigInt"
import * as ByteSize from "effect/ByteSize"
import * as Cause from "effect/Cause"
import * as Effect from "effect/Effect"
import * as FileSystem from "effect/FileSystem"
import * as Function from "effect/Function"
import * as Layer from "effect/Layer"
import * as Option from "effect/Option"
import * as Error from "effect/PlatformError"
import * as Queue from "effect/Queue"
import * as Stream from "effect/Stream"

const handleBadArgument = (method: string) => (err: unknown) =>
  Error.badArgument({
    module: "FileSystem",
    method,
    description: (err as Error).message ?? String(err),
  })

const bigintToNumberOption = (value: bigint | undefined): Option.Option<number> =>
  Option.flatMap(Option.fromNullishOr(value), BigInt.toNumber)

// Node fills bigint stats from a BigInt64Array, so unsigned 64-bit values such
// as dev_t and ino_t at or above 2^63 are reported as negative.
const toUint64 = (value: bigint): bigint => globalThis.BigInt.asUintN(64, value)

const toUint64Option = (value: bigint | undefined): Option.Option<bigint> =>
  Option.map(Option.fromNullishOr(value), toUint64)

const access = ((): FileSystem.FileSystem["access"] => {
  const nodeAccess = Effect.effectify(
    NFS.access,
    handleErrnoException("FileSystem", "access"),
    handleBadArgument("access"),
  )
  return (path, options) => {
    let mode = NFS.constants.F_OK
    if (options?.readable) {
      mode |= NFS.constants.R_OK
    }
    if (options?.writable) {
      mode |= NFS.constants.W_OK
    }
    return nodeAccess(path, mode)
  }
})()

const copy = ((): FileSystem.FileSystem["copy"] => {
  const nodeCp = Effect.effectify(
    NFS.cp,
    handleErrnoException("FileSystem", "copy"),
    handleBadArgument("copy"),
  )
  return (fromPath, toPath, options) =>
    nodeCp(fromPath, toPath, {
      force: options?.overwrite ?? false,
      preserveTimestamps: options?.preserveTimestamps ?? false,
      recursive: true,
    })
})()

const copyFile = (() => {
  const nodeCopyFile = Effect.effectify(
    NFS.copyFile,
    handleErrnoException("FileSystem", "copyFile"),
    handleBadArgument("copyFile"),
  )
  return (fromPath: string, toPath: string) => nodeCopyFile(fromPath, toPath)
})()

const chmod = (() => {
  const nodeChmod = Effect.effectify(
    NFS.chmod,
    handleErrnoException("FileSystem", "chmod"),
    handleBadArgument("chmod"),
  )
  return (path: string, mode: number) => nodeChmod(path, mode)
})()

const chown = (() => {
  const nodeChown = Effect.effectify(
    NFS.chown,
    handleErrnoException("FileSystem", "chown"),
    handleBadArgument("chown"),
  )
  return (path: string, uid: number, gid: number) => nodeChown(path, uid, gid)
})()

const glob = ((): FileSystem.FileSystem["glob"] => {
  const nodeGlob = Effect.effectify(
    NFS.glob,
    handleErrnoException("FileSystem", "glob"),
    handleBadArgument("glob"),
  )
  return (pattern: string, options) =>
    nodeGlob(pattern, {
      cwd: options?.root,
      exclude: options?.exclude,
    })
})()

const link = (() => {
  const nodeLink = Effect.effectify(
    NFS.link,
    handleErrnoException("FileSystem", "link"),
    handleBadArgument("link"),
  )
  return (existingPath: string, newPath: string) => nodeLink(existingPath, newPath)
})()

const makeDirectory = ((): FileSystem.FileSystem["makeDirectory"] => {
  const nodeMkdir = Effect.effectify(
    NFS.mkdir,
    handleErrnoException("FileSystem", "makeDirectory"),
    handleBadArgument("makeDirectory"),
  )
  return (path, options) =>
    nodeMkdir(path, {
      recursive: options?.recursive ?? false,
      mode: options?.mode,
    })
})()

const makeTempDirectoryFactory = (method: string): FileSystem.FileSystem["makeTempDirectory"] => {
  const nodeMkdtemp = Effect.effectify(
    NFS.mkdtemp,
    handleErrnoException("FileSystem", method),
    handleBadArgument(method),
  )
  return (options) =>
    Effect.suspend(() => {
      const prefix = options?.prefix ?? ""
      const directory =
        typeof options?.directory === "string" ? Path.join(options.directory, ".") : OS.tmpdir()

      return nodeMkdtemp(prefix ? Path.join(directory, prefix) : directory + "/")
    })
}
const makeTempDirectory = makeTempDirectoryFactory("makeTempDirectory")

const removeFactory = (method: string): FileSystem.FileSystem["remove"] => {
  const nodeRm = Effect.effectify(
    NFS.rm,
    handleErrnoException("FileSystem", method),
    handleBadArgument(method),
  )
  return (path, options) =>
    nodeRm(path, { recursive: options?.recursive ?? false, force: options?.force ?? false })
}
const remove = removeFactory("remove")

const makeTempDirectoryScoped = ((): FileSystem.FileSystem["makeTempDirectoryScoped"] => {
  const makeDirectory = makeTempDirectoryFactory("makeTempDirectoryScoped")
  const removeDirectory = removeFactory("makeTempDirectoryScoped")
  return (options) =>
    Effect.acquireRelease(makeDirectory(options), (directory) =>
      Effect.orDie(removeDirectory(directory, { recursive: true })),
    )
})()

const openFactory = (method: string): FileSystem.FileSystem["open"] => {
  const nodeOpen = Effect.effectify(
    NFS.open,
    handleErrnoException("FileSystem", method),
    handleBadArgument(method),
  )
  const nodeClose = Effect.effectify(
    NFS.close,
    handleErrnoException("FileSystem", method),
    handleBadArgument(method),
  )

  return (path, options) =>
    Function.pipe(
      Effect.acquireRelease(nodeOpen(path, options?.flag ?? "r", options?.mode), (fd) =>
        Effect.orDie(nodeClose(fd)),
      ),
      Effect.map((fd) => makeFile(fd, options?.flag?.startsWith("a") ?? false)),
    )
}
const open = openFactory("open")

const makeFile = (() => {
  const nodeReadFactory = (method: string) =>
    Effect.effectify(
      NFS.read,
      handleErrnoException("FileSystem", method),
      handleBadArgument(method),
    )
  const nodeRead = nodeReadFactory("read")
  const nodeReadAlloc = nodeReadFactory("readAlloc")
  const nodeStat = Effect.effectify(
    NFS.fstat,
    handleErrnoException("FileSystem", "stat"),
    handleBadArgument("stat"),
  )
  const nodeTruncate = Effect.effectify(
    NFS.ftruncate,
    handleErrnoException("FileSystem", "truncate"),
    handleBadArgument("truncate"),
  )

  const nodeSync = Effect.effectify(
    NFS.fsync,
    handleErrnoException("FileSystem", "sync"),
    handleBadArgument("sync"),
  )

  const nodeWriteFactory = (method: string) =>
    Effect.effectify(
      NFS.write,
      handleErrnoException("FileSystem", method),
      handleBadArgument(method),
    )
  const nodeWrite = nodeWriteFactory("write")
  const nodeWriteAll = nodeWriteFactory("writeAll")

  class FileImpl implements FileSystem.File {
    readonly [FileSystem.FileTypeId]: typeof FileSystem.FileTypeId
    readonly fd: number
    private readonly append: boolean

    private position: bigint = globalThis.BigInt(0)

    constructor(fd: number, append: boolean) {
      this[FileSystem.FileTypeId] = FileSystem.FileTypeId
      this.fd = fd
      this.append = append
    }

    get stat() {
      return Effect.flatMap(nodeStat(this.fd, { bigint: true }), (stat) => makeFileInfo(stat))
    }

    get sync() {
      return nodeSync(this.fd)
    }

    seek(offset: bigint, from: FileSystem.SeekMode) {
      return Effect.sync(() => {
        if (from === "start") {
          this.position = offset
        } else if (from === "current") {
          this.position = this.position + offset
        }

        return this.position
      })
    }

    read(buffer: Uint8Array) {
      return Effect.suspend(() => {
        const position = this.position
        return Effect.map(nodeRead(this.fd, { buffer, position }), (bytesRead) => {
          this.position = position + globalThis.BigInt(bytesRead)
          return bytesRead
        })
      })
    }

    readAlloc(size: number) {
      return Effect.suspend(() => {
        const buffer = Buffer.allocUnsafeSlow(size)
        const position = this.position
        return Effect.map(
          nodeReadAlloc(this.fd, { buffer, position }),
          (bytesRead): Option.Option<Buffer> => {
            if (bytesRead === 0) {
              return Option.none()
            }

            this.position = position + globalThis.BigInt(bytesRead)
            if (bytesRead === size) {
              return Option.some(buffer)
            }

            const dst = Buffer.allocUnsafeSlow(bytesRead)
            buffer.copy(dst, 0, 0, bytesRead)
            return Option.some(dst)
          },
        )
      })
    }

    truncate(length?: number) {
      return Effect.map(nodeTruncate(this.fd, length ? Number(length) : undefined), () => {
        if (!this.append) {
          const len = globalThis.BigInt(length ?? 0)
          if (this.position > len) {
            this.position = len
          }
        }
      })
    }

    write(buffer: Uint8Array) {
      return Effect.suspend(() => {
        const position = this.position
        return Effect.map(
          nodeWrite(
            this.fd,
            buffer,
            undefined,
            undefined,
            this.append ? undefined : Number(position),
          ),
          (bytesWritten) => {
            if (!this.append) {
              this.position = position + globalThis.BigInt(bytesWritten)
            }
            return bytesWritten
          },
        )
      })
    }

    private writeAllChunk(buffer: Uint8Array): Effect.Effect<void, Error.PlatformError> {
      return Effect.suspend(() => {
        const position = this.position
        return Effect.flatMap(
          nodeWriteAll(
            this.fd,
            buffer,
            undefined,
            undefined,
            this.append ? undefined : Number(position),
          ),
          (bytesWritten) => {
            if (bytesWritten === 0) {
              return Effect.fail(
                Error.systemError({
                  module: "FileSystem",
                  method: "writeAll",
                  _tag: "WriteZero",
                  pathOrDescriptor: this.fd,
                  description: "write returned 0 bytes written",
                }),
              )
            }

            if (!this.append) {
              this.position = position + globalThis.BigInt(bytesWritten)
            }

            return bytesWritten < buffer.length
              ? this.writeAllChunk(buffer.subarray(bytesWritten))
              : Effect.void
          },
        )
      })
    }

    writeAll(buffer: Uint8Array) {
      return this.writeAllChunk(buffer)
    }
  }

  return (fd: number, append: boolean): FileSystem.File => new FileImpl(fd, append)
})()

const makeTempFileFactory = (method: string): FileSystem.FileSystem["makeTempFile"] => {
  const makeDirectory = makeTempDirectoryFactory(method)
  return Effect.fnUntraced(function* (options) {
    const directory = yield* makeDirectory(options)
    const random = Crypto.randomBytes(6).toString("hex")
    const name = Path.join(directory, options?.suffix ? `${random}${options.suffix}` : random)
    yield* writeFile(name, new Uint8Array(0))
    return name
  })
}
const makeTempFile = makeTempFileFactory("makeTempFile")

const makeTempFileScoped = ((): FileSystem.FileSystem["makeTempFileScoped"] => {
  const makeFile = makeTempFileFactory("makeTempFileScoped")
  const removeDirectory = removeFactory("makeTempFileScoped")
  return (options) =>
    Effect.acquireRelease(makeFile(options), (file) =>
      Effect.orDie(removeDirectory(Path.dirname(file), { recursive: true })),
    )
})()

const readDirectory: FileSystem.FileSystem["readDirectory"] = (path, options) =>
  Effect.tryPromise({
    try: () => NFS.promises.readdir(path, options),
    catch: (err) => handleErrnoException("FileSystem", "readDirectory")(err as any, [path]),
  })

const readDirectoryEntries = (path: string) =>
  Effect.tryPromise({
    try: () => NFS.promises.readdir(path, { withFileTypes: true }),
    catch: (err) => handleErrnoException("FileSystem", "readDirectoryEntries")(err as any, [path]),
  }).pipe(
    Effect.map((entries) => entries.map((entry) => ({ name: entry.name, type: fileType(entry) }))),
  )

const readFile = (path: string) =>
  Effect.callback<Uint8Array, Error.PlatformError>((resume, signal) => {
    try {
      NFS.readFile(path, { signal }, (err, data) => {
        if (err) {
          resume(Effect.fail(handleErrnoException("FileSystem", "readFile")(err, [path])))
        } else {
          resume(Effect.succeed(data))
        }
      })
    } catch (err) {
      resume(Effect.fail(handleBadArgument("readFile")(err)))
    }
  })

const readLink = (() => {
  const nodeReadLink = Effect.effectify(
    NFS.readlink,
    handleErrnoException("FileSystem", "readLink"),
    handleBadArgument("readLink"),
  )
  return (path: string) => nodeReadLink(path)
})()

const realPath = (() => {
  const nodeRealPath = Effect.effectify(
    NFS.realpath,
    handleErrnoException("FileSystem", "realPath"),
    handleBadArgument("realPath"),
  )
  return (path: string) => nodeRealPath(path)
})()

const rename = (() => {
  const nodeRename = Effect.effectify(
    NFS.rename,
    handleErrnoException("FileSystem", "rename"),
    handleBadArgument("rename"),
  )
  return (oldPath: string, newPath: string) => nodeRename(oldPath, newPath)
})()

const fileType = (stat: NFS.BigIntStats | NFS.Dirent): FileSystem.File.Type =>
  stat.isFile()
    ? "File"
    : stat.isDirectory()
      ? "Directory"
      : stat.isSymbolicLink()
        ? "SymbolicLink"
        : stat.isBlockDevice()
          ? "BlockDevice"
          : stat.isCharacterDevice()
            ? "CharacterDevice"
            : stat.isFIFO()
              ? "FIFO"
              : stat.isSocket()
                ? "Socket"
                : "Unknown"

const makeFileInfo = (
  stat: NFS.BigIntStats,
  method = "stat",
): Effect.Effect<FileSystem.File.Info, Error.PlatformError> =>
  Effect.try({
    try: (): FileSystem.File.Info => {
      const mode = Number(stat.mode)
      if (!Number.isSafeInteger(mode)) {
        throw new RangeError(`mode exceeds the safe integer range: ${stat.mode}`)
      }
      return {
        type: fileType(stat),
        mtime: Option.fromNullishOr(stat.mtime),
        atime: Option.fromNullishOr(stat.atime),
        birthtime: Option.fromNullishOr(stat.birthtime),
        dev: toUint64(stat.dev),
        rdev: toUint64Option(stat.rdev),
        ino: toUint64Option(stat.ino),
        mode,
        nlink: toUint64Option(stat.nlink),
        uid: bigintToNumberOption(stat.uid),
        gid: bigintToNumberOption(stat.gid),
        size: ByteSize.bytes(stat.size),
        blksize:
          stat.blksize !== undefined ? Option.some(ByteSize.bytes(stat.blksize)) : Option.none(),
        blocks: Option.fromNullishOr(stat.blocks),
      }
    },
    catch: handleBadArgument(method),
  })

const statFactory = (method: string, nodeStatFn: typeof NFS.stat) => {
  const nodeStat = Effect.effectify(
    nodeStatFn,
    handleErrnoException("FileSystem", method),
    handleBadArgument(method),
  )
  return (path: string) =>
    Effect.flatMap(nodeStat(path, { bigint: true }), (stat) => makeFileInfo(stat, method))
}
const stat = statFactory("stat", NFS.stat)
const lstat = statFactory("lstat", NFS.lstat)

const symlink = (() => {
  const nodeSymlink = Effect.effectify(
    NFS.symlink,
    handleErrnoException("FileSystem", "symlink"),
    handleBadArgument("symlink"),
  )
  return (target: string, path: string) => nodeSymlink(target, path)
})()

const truncate = (() => {
  const nodeTruncate = Effect.effectify(
    NFS.truncate,
    handleErrnoException("FileSystem", "truncate"),
    handleBadArgument("truncate"),
  )
  return (path: string, length?: number) =>
    nodeTruncate(path, length !== undefined ? Number(length) : undefined)
})()

const utimes = (() => {
  const nodeUtimes = Effect.effectify(
    NFS.utimes,
    handleErrnoException("FileSystem", "utime"),
    handleBadArgument("utime"),
  )
  return (path: string, atime: number | Date, mtime: number | Date) =>
    nodeUtimes(path, atime, mtime)
})()

const watchNode = (path: string, options?: FileSystem.WatchOptions) =>
  Stream.callback<FileSystem.WatchEvent, Error.PlatformError>((queue) =>
    Effect.acquireRelease(
      Effect.sync(() => {
        const watcher = NFS.watch(
          path,
          {
            recursive: options?.recursive ?? false,
          },
          (event, path) => {
            if (!path) return
            switch (event) {
              case "rename": {
                Effect.runFork(
                  Effect.matchEffect(stat(path), {
                    onSuccess: (_) => Queue.offer(queue, { _tag: "Create", path }),
                    onFailure: (_) => Queue.offer(queue, { _tag: "Remove", path }),
                  }),
                )
                return
              }
              case "change": {
                Queue.offerUnsafe(queue, { _tag: "Update", path })
                return
              }
            }
          },
        )
        watcher.on("error", (error) => {
          Queue.failCauseUnsafe(
            queue,
            Cause.fail(
              Error.systemError({
                module: "FileSystem",
                _tag: "Unknown",
                method: "watch",
                pathOrDescriptor: path,
                cause: error,
              }),
            ),
          )
        })
        watcher.on("close", () => {
          Queue.endUnsafe(queue)
        })
        return watcher
      }),
      (watcher) => Effect.sync(() => watcher.close()),
    ),
  )

const watch = (
  backend: Option.Option<FileSystem.WatchBackend["Service"]>,
  path: string,
  options?: FileSystem.WatchOptions,
) =>
  stat(path).pipe(
    Effect.map((stat) =>
      backend.pipe(
        Option.flatMap((_) => _.register(path, stat, options)),
        Option.getOrElse(() => watchNode(path, options)),
      ),
    ),
    Stream.unwrap,
  )

const writeFile: FileSystem.FileSystem["writeFile"] = (path, data, options) =>
  Effect.callback<void, Error.PlatformError>((resume, signal) => {
    try {
      NFS.writeFile(
        path,
        data,
        {
          signal,
          flag: options?.flag,
          mode: options?.mode,
        },
        (err) => {
          if (err) {
            resume(Effect.fail(handleErrnoException("FileSystem", "writeFile")(err, [path])))
          } else {
            resume(Effect.void)
          }
        },
      )
    } catch (err) {
      resume(Effect.fail(handleBadArgument("writeFile")(err)))
    }
  })

const makeFileSystem = Effect.map(Effect.serviceOption(FileSystem.WatchBackend), (backend) => {
  // Effect 4.0 takes `glob` from the implementation. 4.1 derives its own and rejects the key in an
  // object literal, so the implementation is passed as a value.
  const implementation = {
    access,
    chmod,
    chown,
    copy,
    copyFile,
    glob,
    link,
    lstat,
    makeDirectory,
    makeTempDirectory,
    makeTempDirectoryScoped,
    makeTempFile,
    makeTempFileScoped,
    open,
    readDirectory,
    readDirectoryEntries,
    readFile,
    readLink,
    realPath,
    remove,
    rename,
    stat,
    symlink,
    truncate,
    utimes,
    watch: (path: string, options?: FileSystem.WatchOptions) => watch(backend, path, options),
    writeFile,
  }
  return FileSystem.make(implementation)
})

export const layer: Layer.Layer<FileSystem.FileSystem> = Layer.effect(FileSystem.FileSystem)(
  makeFileSystem,
)

export function handleErrnoException(module: string, method: string) {
  return function (
    err: NodeJS.ErrnoException,
    [path]: [path: NFS.PathLike | number | string | ReadonlyArray<string>, ...args: Array<any>],
  ): Error.PlatformError {
    let reason: Error.SystemErrorTag = "Unknown"

    switch (err.code) {
      case "ENOENT":
        reason = "NotFound"
        break
      case "EACCES":
        reason = "PermissionDenied"
        break
      case "EEXIST":
        reason = "AlreadyExists"
        break
      case "EISDIR":
      case "ENOTDIR":
      case "ELOOP":
        reason = "BadResource"
        break
      case "EBUSY":
        reason = "Busy"
        break
    }

    return Error.systemError({
      _tag: reason,
      module,
      method,
      pathOrDescriptor: path as string | number,
      syscall: err.syscall,
      cause: err,
    })
  }
}
