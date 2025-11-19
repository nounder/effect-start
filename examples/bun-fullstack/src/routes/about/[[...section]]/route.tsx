import {
  Effect,
  Function,
  Schema,
} from "effect"
import { Route } from "effect-start"

export default Route
  // this will need to be accessible via type so manifest can verify
  // segmented params has these params in a route.
  // (this justifies having segments in the manifest now.)
  .schemaUrlParams({
    section: Function.pipe(
      Schema.String,
      Schema.optional,
    ),
  })
  .html(function*(ctx) {
    // ctx.params should be bsaed on schema provided to schemaParams above
    const page = ctx.urlParams.section

    return (
      <div>
        <h1>
          About ${page}
        </h1>
      </div>
    )
  })
