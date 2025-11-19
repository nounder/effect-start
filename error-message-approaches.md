# Three Approaches for Better Type Error Messages

## Current Error:
```
Type 'typeof Number$' is not assignable to type 'never'.
```

---

## Approach 1: Type Parameter Constraint ⭐ **RECOMMENDED**

**Strategy:** Constrain the type parameter to only accept valid schema types.

**Actual Error Message:**
```typescript
schemaHeaders({
  "x-count": Schema.Number,  // ← Error here
})

// Error:
Type 'typeof Number$' is not assignable to type 'StringOrArrayEncodedSchema'.
  Type 'typeof Number$' is not assignable to type 'Schema<any, string | string[] | readonly string[], any>'.
    Types of property 'Encoded' are incompatible.
      Type 'number' is not assignable to type 'string | string[] | readonly string[]'.
```

**Pros:**
- ✅ Shows exactly what schema types ARE allowed
- ✅ Shows the core issue: `'Encoded' property incompatible`
- ✅ Shows the actual type conflict: `number` vs `string | string[] | readonly string[]`
- ✅ Native TypeScript error, familiar to developers
- ✅ Clean, progressive disclosure (general → specific)

**Cons:**
- None significant - this is the best approach

**Implementation Complexity:** Low

---

## Approach 2: Descriptive Error Object

**Strategy:** Replace `never` with an error object containing diagnostic info.

**Actual Error Message:**
```typescript
schemaHeaders({
  "x-count": Schema.Number,  // ← Error here
})

// Error:
Type 'typeof Number$' is missing the following properties from type
  'StringOrArrayEncodedError<typeof Number$>': error, expected, got
```

**Pros:**
- Shows named error type
- Can include custom error messages

**Cons:**
- ❌ Doesn't show the actual type values (just says "missing properties")
- ❌ Error object type appears in autocomplete (confusing UX)
- ❌ Less informative than Approach 1
- ❌ Indirect error message

**Implementation Complexity:** Medium

---

## Approach 3: Hybrid Constraint + Validation

**Strategy:** Combine type constraint with conditional validation for double-checking.

**Actual Error Message:**
```typescript
schemaHeaders({
  "x-count": Schema.Number,  // ← Error here
})

// Error:
Type 'typeof Number$' is not assignable to type 'StringOrArrayEncodedSchema'.
  Type 'typeof Number$' is not assignable to type 'Schema<any, string | string[] | readonly string[], any>'.
    Types of property 'Encoded' are incompatible.
      Type 'number' is not assignable to type 'string | string[] | readonly string[]'.
```

**Pros:**
- ✅ Same excellent error message as Approach 1
- ✅ Extra validation layer (belt and suspenders)

**Cons:**
- More complex implementation
- Doesn't provide additional value over Approach 1

**Implementation Complexity:** High

---

## Recommendation: **Approach 1** 🏆

**Approach 1 (Type Parameter Constraint)** is the clear winner because:

1. **Best error message:** Shows the exact type mismatch at the `Encoded` property level
2. **Progressive detail:** Goes from general (`StringOrArrayEncodedSchema`) → specific (`number` vs `string | string[]`)
3. **Simplest implementation:** Just add a constraint, no complex mapped types
4. **Native TypeScript:** Uses familiar error format developers already understand
5. **Actionable:** Clearly shows what types ARE allowed

### Error Message Breakdown:
```
Type 'typeof Number$' is not assignable to type 'StringOrArrayEncodedSchema'.
└─→ "You passed Schema.Number, but that's not an allowed type"

  Type 'typeof Number$' is not assignable to type 'Schema<any, string | string[] | readonly string[], any>'.
  └─→ "Specifically, it doesn't match this schema signature"

    Types of property 'Encoded' are incompatible.
    └─→ "The problem is in the Encoded type property"

      Type 'number' is not assignable to type 'string | string[] | readonly string[]'.
      └─→ "number (what you have) vs string/string[] (what we need)"
```
