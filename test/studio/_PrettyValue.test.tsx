import * as test from "bun:test"
import * as Html from "../../src/Html.ts"
import * as PrettyValue from "../../src/studio/ui/_PrettyValue.tsx"

test.describe("_PrettyValue", () => {
  test.it("renders structured values inside pre blocks", () => {
    const html = Html.renderToString(
      <PrettyValue.PrettyValue
        value={{ nested: { ok: true } }}
        preStyle="margin:0;white-space:pre-wrap"
      />,
    )

    test.expect(html).toContain("<pre")
    test.expect(html).toContain("&quot;nested&quot;")
    test.expect(html).toContain("&#10;")
  })
})
