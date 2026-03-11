# Datastar

This is a port of [Datastar](https://github.com/starfederation/datastar) of magnificent Star Federation.

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
- `data-computed` supports object values with function leaves:
  - String/object-literal form still works: `data-computed="{statusText: (e) => e.signals.state}"`
  - JSX object form also works: `data-computed={{ statusText: (e) => e.signals.state }}`
  - Object values only accept functions at the leaves
  - JSX typing allows `data-computed` object values
- `data-on` supports function form:
  - Function form: `data-on:click="(e) => { e.signals.count = e.signals.count + 1 }"`
  - Event names are used literally from the attribute key; upstream `modifyCasing(..., "kebab")` normalization is no longer applied
