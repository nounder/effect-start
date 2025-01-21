import Context from "effect/Context"

export class Vite extends Context.Tag("Vite")<Vite, {
  fetch: (req: Request) => Promise<Response> | Response
  // this may not be necssary?
  manifest?: any
}>() {}
