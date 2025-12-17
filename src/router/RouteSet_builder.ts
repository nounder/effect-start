import * as Hyper from "../hyper/Hyper.ts"
import * as Values from "../Values.ts"
import * as _handler from "./RouteSet_handler.ts"
import * as _http from "./RouteSet_http.ts"
import * as _method from "./RouteSet_method.ts"
import * as _schema from "./RouteSet_schema.ts"

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

export const text = _handler.makeHandlerMaker<"GET", "text", string>(
  "GET",
  "text",
)
export const html = _handler.makeHandlerMaker<
  "GET",
  "html",
  string | Hyper.GenericJsxObject
>(
  "GET",
  "html",
)
export const json = _handler.makeHandlerMaker<
  "GET",
  "json",
  Values.Json
>(
  "GET",
  "json",
)

export const http = _http.http
