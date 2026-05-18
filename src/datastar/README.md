# Datastar

This is a port of [Datastar](https://github.com/starfederation/datastar) of magnificent Star Federation.

Upstream base: **v1.0.1** (commit `32be7fe`).

We experimentally place it inside Effect Start to have tighter integration with it and provide
great out-of-the-box experience. After cleaning up the code, we're at around ~90kb of source code.
We can probably cut it down by another ~10kb if we remove DataStar expression and use JS functions directly.

We made following changes:

- Path aliases converted to relative imports: `@engine/*` → `./engine/*`, etc.
- Flattened and merged the source tree:
  - `plugins/actions|attributes|watchers` → `actions|attributes|watchers`
  - `engine/{consts,types,signals,engine}.ts` → `engine.ts`
  - `utils/{dom,math,paths,polyfills,tags,text,timing,view-transitions}.ts` → `utils.ts`
- Replaced upstream `bundles/` entrypoints with local `index.ts`:
  - Registers all plugins as side effects
  - Re-exports all of `engine.ts` instead of upstream's narrower bundle export surface
- Removed alias build support:
  - Deleted `globals.d.ts`
  - `aliasify()` always produces `data-${name}`
  - `applyAttributePlugin` no longer accepts aliased `data-${ALIAS}-*` attributes
- Removed plugin header comments.
- Updated type declaration to conform to `erasableSyntaxOnly`:
  - Converted `enum ReactiveFlags` and `enum EffectFlags` to `const` objects with `as const`
  - Added type aliases `ReactiveFlags_X` to replace `ReactiveFlags.X` namespace types
- Extended expressions with function form handled by `genRx`:
  - Function expressions are evaluated directly instead of compiled through Datastar's string-expression transform
  - Function expressions receive a `DataEvent` object with `signals`, `actions`, `target`, and `window`
  - Shared expression-event setup is centralized in `createDataEvent()` and reused by both `genRx` and `data-computed`
  - Value-returning object literals are compiled as `return ({...});` so block-bodied arrow functions inside object expressions still parse
- Object-form `data-class`, `data-attr`, `data-style`, and `data-computed` accept function leaves:
  - JSX form: `data-class={{ invisible: (e) => !e.signals.draft.trim() }}`
  - Also works for `data-attr={{ disabled: (e) => ... }}` and `data-style={{ color: (e) => ... }}`
  - Object serialization goes through `serializeObjectProperty`, which inlines functions via `.toString()` instead of `JSON.stringify` (which would drop them)
  - The wrapped `ctx.rx` in the plugin runner eagerly invokes function leaves on each tick with a fresh `DataEvent`, so plugins receive primitives and need no changes
  - `data-computed` is the one exception (skipped by name) — it wraps each function in `computed()` itself to preserve per-leaf signal tracking
  - JSX typing widens `DatastarClassObject` / `DatastarAttrObject` / `DatastarStyleObject` values to include `DataFunction`
- `data-on` supports function form:
  - Function form: `data-on:click="(e) => { e.signals.count = e.signals.count + 1 }"`
  - Event names are used literally from the attribute key; upstream `modifyCasing(..., "kebab")` normalization is no longer applied
- `data-init` and `data-effect` support unmount cleanups (Solid-style):
  - Function-form expression may return a teardown function; the engine invokes it when the element/attribute is removed
  - `data-init="() => { const id = setInterval(tick, 1000); return () => clearInterval(id) }"`
  - `data-effect` additionally fires the previous run's cleanup before each re-execution caused by a signal change, mirroring `useEffect` / `onCleanup` semantics
  - Non-function return values are ignored, so existing usages (`data-init="$count = 0"`) are unaffected

Intentionally not ported from upstream:

- `jsStrToObject` does not accept the `reviveFunctionStrings` option. Upstream added it but does not call it internally, and the fork already supports JSX function form natively, so revived plain functions would not receive a `DataEvent` and would be redundant.
