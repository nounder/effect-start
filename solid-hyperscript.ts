import { JSX } from "solid-js";

function Component(props: { enabled: boolean }) {
  return h(
    "div",
    {},
    [
      h("svg", {
        viewBox: "makessens",
        onChange: () => "yoo",
      }),
      ["koko"],
    ],
  );
}
