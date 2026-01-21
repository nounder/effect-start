import * as test from "bun:test"
import * as Values from "./Values.ts"

test.describe("isPlainObject", () => {
  test.it("returns true for plain objects", () => {
    test
      .expect(Values.isPlainObject({}))
      .toBe(true)

    test
      .expect(Values.isPlainObject({ a: 1, b: 2 }))
      .toBe(true)

    test
      .expect(Values.isPlainObject({ nested: { value: true } }))
      .toBe(true)
  })

  test.it("returns false for null", () => {
    test
      .expect(Values.isPlainObject(null))
      .toBe(false)
  })

  test.it("returns false for primitives", () => {
    test
      .expect(Values.isPlainObject("string"))
      .toBe(false)

    test
      .expect(Values.isPlainObject(42))
      .toBe(false)

    test
      .expect(Values.isPlainObject(true))
      .toBe(false)

    test
      .expect(Values.isPlainObject(undefined))
      .toBe(false)
  })

  test.it("returns false for ArrayBuffer", () => {
    test
      .expect(Values.isPlainObject(new ArrayBuffer(8)))
      .toBe(false)
  })

  test.it("returns false for ArrayBufferView (Uint8Array)", () => {
    test
      .expect(Values.isPlainObject(new Uint8Array([1, 2, 3])))
      .toBe(false)
  })

  test.it("returns false for Blob", () => {
    test
      .expect(Values.isPlainObject(new Blob(["test"])))
      .toBe(false)
  })

  test.it("returns false for FormData", () => {
    test
      .expect(Values.isPlainObject(new FormData()))
      .toBe(false)
  })

  test.it("returns false for URLSearchParams", () => {
    test
      .expect(Values.isPlainObject(new URLSearchParams()))
      .toBe(false)
  })

  test.it("returns false for ReadableStream", () => {
    test
      .expect(Values.isPlainObject(new ReadableStream()))
      .toBe(false)
  })

  test.it("returns false for arrays", () => {
    test
      .expect(Values.isPlainObject([]))
      .toBe(false)

    test
      .expect(Values.isPlainObject([1, 2, 3]))
      .toBe(false)
  })

  test.it("returns false for functions", () => {
    test
      .expect(Values.isPlainObject(() => {}))
      .toBe(false)

    test
      .expect(Values.isPlainObject(function() {}))
      .toBe(false)
  })

  test.it("returns false for class instances", () => {
    class MyClass {
      value = 42
    }

    test
      .expect(Values.isPlainObject(new MyClass()))
      .toBe(false)
  })

  test.it("returns false for Date", () => {
    test
      .expect(Values.isPlainObject(new Date()))
      .toBe(false)
  })

  test.it("returns false for Map", () => {
    test
      .expect(Values.isPlainObject(new Map()))
      .toBe(false)
  })

  test.it("returns false for Set", () => {
    test
      .expect(Values.isPlainObject(new Set()))
      .toBe(false)
  })

  test.it("returns false for RegExp", () => {
    test
      .expect(Values.isPlainObject(/test/))
      .toBe(false)
  })

  test.it("returns false for Error", () => {
    test
      .expect(Values.isPlainObject(new Error("test")))
      .toBe(false)
  })

  test.it("returns false for Promise", () => {
    test
      .expect(Values.isPlainObject(Promise.resolve()))
      .toBe(false)
  })

  test.it("returns true for Object.create(null)", () => {
    test
      .expect(Values.isPlainObject(Object.create(null)))
      .toBe(true)
  })
})

test.describe("IsPlainObject", () => {
  test.it("returns true for plain objects", () => {
    test
      .expectTypeOf<Values.IsPlainObject<{ a: number }>>()
      .toEqualTypeOf<true>()

    test
      .expectTypeOf<Values.IsPlainObject<{ a: number; b: string }>>()
      .toEqualTypeOf<true>()

    test
      .expectTypeOf<Values.IsPlainObject<{}>>()
      .toEqualTypeOf<true>()
  })

  test.it("returns false for functions", () => {
    test
      .expectTypeOf<Values.IsPlainObject<() => void>>()
      .toEqualTypeOf<false>()

    test
      .expectTypeOf<Values.IsPlainObject<(a: number) => string>>()
      .toEqualTypeOf<false>()
  })

  test.it("returns false for built-in classes", () => {
    test
      .expectTypeOf<Values.IsPlainObject<Request>>()
      .toEqualTypeOf<false>()

    test
      .expectTypeOf<Values.IsPlainObject<Response>>()
      .toEqualTypeOf<false>()

    test
      .expectTypeOf<Values.IsPlainObject<Date>>()
      .toEqualTypeOf<false>()

    test
      .expectTypeOf<Values.IsPlainObject<Map<string, number>>>()
      .toEqualTypeOf<false>()
  })

  test.it("returns false for primitives", () => {
    test
      .expectTypeOf<Values.IsPlainObject<string>>()
      .toEqualTypeOf<false>()

    test
      .expectTypeOf<Values.IsPlainObject<number>>()
      .toEqualTypeOf<false>()

    test
      .expectTypeOf<Values.IsPlainObject<boolean>>()
      .toEqualTypeOf<false>()
  })
})

test.describe("Simplify", () => {
  test.it("expands nested plain objects", () => {
    type Input = {
      readonly a: { readonly x: number }
      readonly b: string
    }

    test
      .expectTypeOf<Values.Simplify<Input>>()
      .toEqualTypeOf<{
        a: { x: number }
        b: string
      }>()
  })

  test.it("preserves Request type", () => {
    type Input = {
      request: Request
      data: { value: number }
    }

    type Result = Values.Simplify<Input>

    test
      .expectTypeOf<Result["request"]>()
      .toEqualTypeOf<Request>()

    test
      .expectTypeOf<Result["data"]>()
      .toEqualTypeOf<{ value: number }>()
  })

  test.it("preserves other built-in types", () => {
    type Input = {
      date: Date
      map: Map<string, number>
      response: Response
    }

    type Result = Values.Simplify<Input>

    test
      .expectTypeOf<Result["date"]>()
      .toEqualTypeOf<Date>()

    test
      .expectTypeOf<Result["map"]>()
      .toEqualTypeOf<Map<string, number>>()

    test
      .expectTypeOf<Result["response"]>()
      .toEqualTypeOf<Response>()
  })
})
