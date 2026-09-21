// Shared DOM setup for page-model tests: linkedom standing in for the browser.
//
// page.js predicts the *browser* serialisation when it records the
// original-formatting mappings, and linkedom differs from browsers in two
// places, so we patch those to match Chrome/Firefox/Safari:
//   - HTML attribute values: linkedom writes them raw (only `"` escaped);
//     browsers escape `&` → &amp;, U+00A0 → &nbsp;, `"` → &quot;.
//   - Text nodes: linkedom writes U+00A0 as &#160;, browsers as &nbsp;.
// Without this, a page whose links contain `&amp;` or whose footer contains a
// non-breaking space round-trips cleanly in a browser yet fails here.
// Valueless attributes keep linkedom's own handling (existing fixtures cover
// it), and <script>/<style> bodies are serialised raw by linkedom separately.
import { DOMParser } from "linkedom";

const scratch = new DOMParser().parseFromString("<html></html>", "text/html");

const attrProto = Object.getPrototypeOf(scratch.createAttribute("x"));
const linkedomAttr = attrProto.toString;
attrProto.toString = function () {
  const value = this.value;
  if (!value) return linkedomAttr.call(this);
  return (
    this.name +
    '="' +
    value.replace(/&/g, "&amp;").replace(/ /g, "&nbsp;").replace(/"/g, "&quot;") +
    '"'
  );
};

const textProto = Object.getPrototypeOf(scratch.createTextNode("x"));
textProto.toString = function () {
  return this.data
    .replace(/&/g, "&amp;")
    .replace(/ /g, "&nbsp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
};

globalThis.DOMParser = DOMParser;
export { DOMParser };
