import {
  Effect,
  Function,
  Schema,
} from "effect"
import { Route } from "effect-start"

export default Route
  .schemaUrlParams({
    section: Function.pipe(
      Schema.String,
      Schema.optional,
    ),
  })
  .html(function*(ctx) {
    const page = ctx.urlParams.section

    return `
      <div>
        <h1>
          About ${page}
        </h1>
      </div>
    `
  })
