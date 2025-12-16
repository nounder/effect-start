type JsonPrimitives =
  | string
  | number
  | boolean
  | null

export type Json =
  | JsonPrimitives
  | Json[]
  | {
    [key: string]: Json
  }
