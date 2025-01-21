export async function getDenoInfo() {
  const cmd = new Deno.Command(Deno.execPath(), {
    args: [
      "info",
      "--json",
    ],
  })
  const output = await cmd.output()

  if (!output.success) {
    const stderr = new TextDecoder().decode(output.stderr).slice(0, 160)

    console.debug("deno info stderr", stderr)
    throw new Error("Failed to get Deno info")
  }

  const stdout = new TextDecoder().decode(output.stdout)

  const parsedInfo = JSON.parse(stdout)

  return parsedInfo as {
    version: number
    denoDir: string
    modulesCache: string
    npmCache: string
    typescriptCache: string
    registryCache: string
    originStorage: string
    webCacheStorage: string
  }
}

