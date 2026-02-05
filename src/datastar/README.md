# Datastar

This is a port of [Datastar](https://github.com/starfederation/datastar) of magnificent Star Federation.

We experimentally place it inside Effect Start to have tighter integration with it and provide
great out-of-the-box experience. After cleaning up the code, we're at around ~90kb of source code.
We can probably cut it down by another ~10kb if we remove DataStar expression and use JS functions directly.

Based on `812cbe9` (2025-02-05) following changes were made:

- Path aliases converted to relative imports: `@engine/*` → `./engine/*`, etc.
- Flattened `plugins/` directory: `plugins/actions/` → `actions/`, etc.
- Deleted the `ALIAS` type declaration: removed `globals.d.ts`,
  no alias conditional in `utils/text.ts` & `applyAttributePlugin` in `engine.ts`.
- Removed plugin header comments.
- Updated type declaration to conform to `erasableSyntaxOnly`:
  - Converted `enum ReactiveFlags` and `enum EffectFlags` to `const` objects with `as const`
  - Added type aliases `ReactiveFlags_X` to replace `ReactiveFlags.X` namespace types
