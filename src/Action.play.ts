// @ts-nocheck
Action
  .use(
    Action.schemaUrlParams(),
    Action
      .text(function*(action) {
        return `Welcome!\n=======\n\n${yield* Action.next}`
      }),
  )
  .get(
    Action.text((action) => Effect.succeed("This is the home page.")),
  )
  .post(
    Action.text((action) => Effect.succeed("Post request received.")),
  )

// only flat string value accepted then serialized
// ContextAction is not added to action chain, only updates ActionSet context?
ContextAction.static({
  method: "GET",
})

// dynamic context will require an id to uniquely identify it
ContextAction.derive(() => {
  return Effect.gen(function*() {
    const req = yield* Route.Request
    const body = yield* request.body
    const payload = Schema.decodeUnknown(req.schema)(body)

    return {
      body,
      payload,
    }
  })
})

ContentAction.make({
  //
  media: "text/plain",
  effect: Effect.gen(function*() {
    return "Hello!"
  }),
})

// only reasony why we need to distignuish
// between HttpAction and ContentAction is to order
// them when routes are merged (we cannot jump between boundaries,
// or we need to chain ContentAction of the same type together)
//
// other ideas how to distinguish them or set the priority?
//
// two action types: ContentAction and MiddlewareAction are consired in HTTP rendering.
// ContextAction is not directly involved in rendering, only in routing.
