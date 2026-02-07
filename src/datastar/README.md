# Datastar

This is a port of [Datastar](https://github.com/starfederation/datastar) of magnificent Star Federation.

We experimentally place it inside Effect Start to have tighter integration with it and provide
great out-of-the-box experience. After cleaning up the code, we're at around ~90kb of source code.
We can probably cut it down by another ~10kb if we remove DataStar expression and use JS functions directly.

We made following changes:

- Path aliases converted to relative imports: `@engine/*` → `./engine/*`, etc.
- Flattened `plugins/` directory: `plugins/actions/` → `actions/`, etc.
- Deleted the `ALIAS` type declaration: removed `globals.d.ts`,
  no alias conditional in `utils/text.ts` & `applyAttributePlugin` in `engine.ts`.
- Removed plugin header comments.
- Updated type declaration to conform to `erasableSyntaxOnly`:
  - Converted `enum ReactiveFlags` and `enum EffectFlags` to `const` objects with `as const`
  - Added type aliases `ReactiveFlags_X` to replace `ReactiveFlags.X` namespace types
- Extends expressions with function form handled by `genRx`
- `data-on` supports function form with optional config object:
  - Function form: `data-on:click="(e) => { e.signals.count.value++ }"`
  - Function form with config: `data-on:click="(e) => {...}, { debounce: 500, prevent: true }"`
  - !! `__` attribute modifiers are no longer parsed by `on.ts` (now removed from imports)
