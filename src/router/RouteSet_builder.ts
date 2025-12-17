import * as Pipeable from "effect/Pipeable"
import * as Hyper from "../hyper/Hyper.ts"
import * as Values from "../Values.ts"
import type * as Route from "./Route.ts"
import * as _handler from "./RouteSet_handler.ts"
import * as _http from "./RouteSet_http.ts"
import * as _method from "./RouteSet_method.ts"
import * as _schema from "./RouteSet_schema.ts"

export function pipe(this: Route.Self) {
  return Pipeable.pipeArguments(this, arguments)
}

export const schemaPathParams = _schema.makeSingleSchemaModifier("PathParams")
export const schemaUrlParams = _schema.makeMultiSchemaModifier("UrlParams")
export const schemaHeaders = _schema.makeMultiSchemaModifier("Headers")
export const schemaPayload = _schema.makeUnionSchemaModifier("Payload")
export const schemaSuccess = _schema.makeUnionSchemaModifier("Success")
export const schemaError = _schema.makeUnionSchemaModifier("Error")

export const post = _method.makeMethodMaker("POST")
export const get = _method.makeMethodMaker("GET")
export const put = _method.makeMethodMaker("PUT")
export const patch = _method.makeMethodMaker("PATCH")
export const options = _method.makeMethodMaker("OPTIONS")
export const head = _method.makeMethodMaker("HEAD")
export const del = _method.makeMethodMaker("DELETE")

export const text = _handler.makeHandlerMaker<"GET", "text/plain", string>(
  "GET",
  "text/plain",
)
export const html = _handler.makeHandlerMaker<
  "GET",
  "text/html",
  string | Hyper.GenericJsxObject
>(
  "GET",
  "text/html",
)
export const json = _handler.makeHandlerMaker<
  "GET",
  "application/json",
  Values.Json
>(
  "GET",
  "application/json",
)

export const http = _http.http
