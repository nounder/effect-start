import * as Context from "effect/Context"
import * as Data from "effect/Data"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Ref from "effect/Ref"
import * as Stream from "effect/Stream"

import type * as ChildProcess from "./_ChildProcess.ts"
import * as System from "./System.ts"

export class DockerError extends Data.TaggedError("DockerError")<{
  message: string
  cause?: unknown
}> {}

export interface ExecResult {
  readonly exitCode: number
  readonly stdout: string
}

export interface Container {
  readonly id: string
  readonly name?: string
  readonly ports?: ReadonlyArray<readonly [host: number, container: number]>
  readonly exec: (
    command: ReadonlyArray<string>,
    options?: { readonly detach?: boolean },
  ) => Effect.Effect<ExecResult, DockerError, ChildProcess.ChildProcessSpawner>
}

export interface ContainerOptions {
  readonly image: string
  readonly name?: string
  readonly detach?: boolean
  readonly rm?: boolean
  readonly env?: Record<string, string>
  readonly ports?: ReadonlyArray<readonly [host: number, container: number]>
  readonly args?: ReadonlyArray<string>
}

export interface DockerService {
  readonly exec: (
    container: string,
    command: ReadonlyArray<string>,
    options?: { readonly detach?: boolean },
  ) => Effect.Effect<ExecResult, DockerError, ChildProcess.ChildProcessSpawner>
  readonly run: (
    options: ContainerOptions,
  ) => Effect.Effect<Container, DockerError, ChildProcess.ChildProcessSpawner>
  readonly start: (
    container: string,
  ) => Effect.Effect<void, DockerError, ChildProcess.ChildProcessSpawner>
  readonly containers: Effect.Effect<ReadonlyArray<Container>>
}

export class Docker extends Context.Tag("effect-start/Docker")<Docker, DockerService>() {}

export class DockerContainer extends Context.Tag("effect-start/DockerContainer")<
  DockerContainer,
  Container
>() {}

const dockerExec = (...args: ReadonlyArray<string>) =>
  Effect.scoped(
    Effect.gen(function* () {
      const handle = yield* System.spawn(["docker", ...args], {
        stdout: "ignore",
        stderr: "inherit",
      })
      return yield* handle.exitCode
    }),
  )

const dockerExecStdout = (...args: ReadonlyArray<string>) =>
  Effect.scoped(
    Effect.gen(function* () {
      const handle = yield* System.spawn(["docker", ...args], {
        stdout: "pipe",
        stderr: "inherit",
      })
      const [stdout, exitCode] = yield* Effect.all(
        [handle.stdout.pipe(Stream.decodeText("utf-8"), Stream.mkString), handle.exitCode],
        { concurrency: 2 },
      )
      return { stdout, exitCode }
    }),
  )

const removeContainer = (container: string) => dockerExec("rm", "-f", container).pipe(Effect.ignore)

export const layer = Layer.scoped(
  Docker,
  Effect.gen(function* () {
    const tracked = yield* Ref.make<ReadonlyArray<Container>>([])

    yield* Effect.addFinalizer(() =>
      Ref.get(tracked).pipe(
        Effect.flatMap((containers) =>
          Effect.forEach(containers, (c) => removeContainer(c.id), { discard: true }),
        ),
      ),
    )

    const track = (container: Container) => Ref.update(tracked, (cs) => [container, ...cs])

    const execFn = (
      container: string,
      command: ReadonlyArray<string>,
      options?: { readonly detach?: boolean },
    ) =>
      Effect.gen(function* () {
        const args: Array<string> = ["exec"]
        if (options?.detach) args.push("-d")
        args.push(container, ...command)

        const result = yield* dockerExecStdout(...args).pipe(
          Effect.mapError((cause) => new DockerError({ message: `docker exec failed`, cause })),
        )

        return { exitCode: result.exitCode, stdout: result.stdout.trim() } satisfies ExecResult
      })

    return {
      exec: execFn,

      run: (options) =>
        Effect.gen(function* () {
          const args: Array<string> = ["run"]

          if (options.detach) args.push("-d")
          if (options.rm) args.push("--rm")
          if (options.name) args.push("--name", options.name)

          if (options.env) {
            for (const [k, v] of Object.entries(options.env)) {
              args.push("-e", `${k}=${v}`)
            }
          }

          if (options.ports) {
            for (const [host, container] of options.ports) {
              args.push("-p", `${host}:${container}`)
            }
          }

          args.push(options.image)

          if (options.args) args.push(...options.args)

          const result = yield* dockerExecStdout(...args).pipe(
            Effect.mapError((cause) => new DockerError({ message: `docker run failed`, cause })),
          )

          const id = result.stdout.trim()
          const container: Container = {
            id,
            name: options.name,
            ports: options.ports,
            exec: (command, execOptions) => execFn(id, command, execOptions),
          }

          if (!options.rm) {
            yield* track(container)
          }

          return container
        }),

      start: (container) =>
        Effect.gen(function* () {
          const code = yield* dockerExec("start", container).pipe(
            Effect.mapError((cause) => new DockerError({ message: `docker start failed`, cause })),
          )
          if (code !== 0) {
            yield* Effect.fail(
              new DockerError({ message: `docker start exited with code ${code}` }),
            )
          }
        }),

      containers: Ref.get(tracked),
    } satisfies DockerService
  }),
)

export const layerContainer = (options: ContainerOptions) =>
  Layer.effect(
    DockerContainer,
    Effect.flatMap(Docker, (docker) => docker.run(options)),
  )
