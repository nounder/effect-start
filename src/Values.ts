type JsonPrimitives =
  | string
  | number
  | boolean
  | null

export type Json =
  | JsonPrimitives
  | Json[]
  | {
    [key: string]:
      | Json
      // undefined won't be included in JSON objects but this will allow
      // to use Json type in functions that return object of multiple shapes
      | undefined
  }
