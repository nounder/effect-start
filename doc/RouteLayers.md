Route Layers are responsible for applying layers when constructing a route.

Route Layers cascades and can be put in arbitrary depth.

We want to resuse Route Layers across all Route Handlers that are under it.

Route Layers is a unifying abstraction over middlewares & layouts.
Both are working the same underneth: middleware are modifying response from
a Route Handler on low leve. Layout do the same but check if the response
is HTML and if it is it wraps its content with a layout.
We want to abstract it away because we don't want to have to seperate interfaces
for doing a very similar thing.

On one hand we could juse use middleware since a layout is nothing else than a middleware
with filtering. However, I expect that beginners will start with layout and introducing
them immedietly to a concept of middleware will be addtional learning step.

Instead we want to utilize concept of Effect's layers and use it amend Route Handlers
in an idiomatic way.

We want to construct Route Layer only once and apply them individually to all Route Handlers.

Because Route Layer is applied only once, we need to know what layout / middleware
will be applied for a specific route. This will require additional global HttpRouter middleware
that reads a Context.Tag that stores information about what layout / middleware to apply for
that specific Route Handler.

When Effects are applied locally to an effect, when will they be executed?
On every Effect execution or once in a runtime?

Maybe we can wrap Route Handler in another Effect that handles the layout.
But them we stray away from singleton nature of Layers, ie. them being
executed only once.

Each Route Layer would provide its own Service/Context.Tag that will be local
to Route Handler. We will probably want that at some point to allow user

We want to allow to pass any HttpMiddleware without any adapters.
We can do so with `Route.layer` which will be required to use in every
`layer.ts` file. We already require this minimal boilerplate in `route.ts`
in a form of `Hyper.handle` (or in the future `Hyper.page`)

HttpMiddleware is a function that accepts a HttpApp and returns in.
Any function will be applied to handler directly.
A layer will be provided to each handler.

---

(`Hyper.handle` can be generic. And `Hyper.page` can be specific
to frontend pages that call `Hyper.action`)

`Hyper.action` can have a similar interface to `Hyper.fn` where
an identifier must be unique and will be used to send POST
request to current page. `Hyper.page` by default handles GET.
When user do POST, we execute action and, because everything
is within the same scope, we can response which will be morphed
to original page.

If `Hyper.page` returns a Stream or an suspended Effect, an additional
SSE endpoint becomes available for the client to pull from the stream.
The challenge here will be to transfer that stream from original request
to SSE. We could use in-memory caching in a short amount of that but that
seems prone to memory leaks and timing problems in chaotic network environment.

---

`Route.layer(): Layer<RouteContext>`
And then the result of Route.layer() will be applied to all handlers.
RouteContext will extends HttpRouter.RouteContext and will contain
additional information like:

```ts
HttpRouter.RouteContext & {
  // not sure about this name. get inspired by rails' respond_to?
  handler: any,
  client: {
    // used to resolve entrypoint from ClientBundle
    moduleUrl: string
    // we probably don't want to import the file in server env
    // bc it might not work there (think solid browser/ssr env diffs)
  },

  // stack will allow for easier debugging
  // layouts are simply middlewares
  middlewareStack: any[],
  middleware: any,


  // used by Route.layer when passed argument is a HttpMiddleware
  addMiddleware: () => void,
  // used by Route.layer when passed argument is a Layer<any, RouteContext>
  // we probably don't need to store layers? (could be useful for debugging)
  provideLayer: () => void,

  
}
```
