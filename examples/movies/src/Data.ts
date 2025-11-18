import * as Data from "effect/Data"
import * as Effect from "effect/Effect"
import * as FileSystem from "@effect/platform/FileSystem"
import * as Path from "@effect/platform/Path"

export interface Movie {
  readonly id: number
  readonly title: string
  readonly year: number
  readonly genre: ReadonlyArray<string>
  readonly director: string
  readonly cast: ReadonlyArray<string>
  readonly rating: number
  readonly plot: string
}

export interface Show {
  readonly id: number
  readonly title: string
  readonly years: string
  readonly seasons: number
  readonly genre: ReadonlyArray<string>
  readonly creator: string
  readonly cast: ReadonlyArray<string>
  readonly rating: number
  readonly plot: string
}

export interface Person {
  readonly id: number
  readonly name: string
  readonly birthYear: number
  readonly nationality: string
  readonly occupation: ReadonlyArray<string>
  readonly knownFor: ReadonlyArray<string>
}

export class DataLoadError extends Data.TaggedError("DataLoadError")<{
  readonly file: string
  readonly cause: unknown
}> {}

export class DataService extends Effect.Service<DataService>()("DataService", {
  effect: Effect.gen(function*() {
    const fs = yield* FileSystem.FileSystem
    const path = yield* Path.Path

    const dataDir = "./examples/movies/data"

    const loadJSON = <T>(filename: string) =>
      Effect.gen(function*() {
        const filePath = path.join(dataDir, filename)
        const content = yield* fs.readFileString(filePath)
        return yield* Effect.try({
          try: () => JSON.parse(content) as T,
          catch: (cause) => new DataLoadError({ file: filename, cause }),
        })
      })

    const movies = yield* loadJSON<ReadonlyArray<Movie>>("movies.json")
    const shows = yield* loadJSON<ReadonlyArray<Show>>("shows.json")
    const people = yield* loadJSON<ReadonlyArray<Person>>("people.json")

    return {
      movies,
      shows,
      people,
      getMovieById: (id: number) => movies.find((m) => m.id === id),
      getShowById: (id: number) => shows.find((s) => s.id === id),
      getPersonById: (id: number) => people.find((p) => p.id === id),
    } as const
  }),
}) {}
