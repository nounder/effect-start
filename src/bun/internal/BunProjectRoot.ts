import * as NPath from "node:path"

export async function find(from: string): Promise<string | undefined> {
  let directory = NPath.dirname(NPath.resolve(from))
  const root = NPath.parse(directory).root

  while (directory !== root) {
    if (await Bun.file(NPath.join(directory, "package.json")).exists()) {
      return directory
    }
    directory = NPath.dirname(directory)
  }
}
