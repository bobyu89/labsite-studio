// Site text size: a marked block at the end of one stylesheet.
import test from "node:test";
import assert from "node:assert/strict";
import { readTextSize, writeTextSize, carryTextSize } from "../src/site/textSize.js";

const CSS = ":root {\n  --ink: #111;\n}\nbody { margin: 0; }\n";

test("writeTextSize adds one block; 標準 gives back the file exactly", () => {
  assert.equal(readTextSize(CSS), 100);
  const big = writeTextSize(CSS, 112.5);
  assert.ok(big.startsWith(CSS));
  assert.match(big, /html \{ font-size: 112\.5%; \}/);
  assert.equal(readTextSize(big), 112.5);
  const bigger = writeTextSize(big, 125);
  assert.equal((bigger.match(/labsite:text-size \*\//g) || []).length, 1, "replaced, not added twice");
  assert.equal(readTextSize(bigger), 125);
  assert.equal(writeTextSize(bigger, 100), CSS);
  assert.equal(writeTextSize(CSS, 100), CSS);
});

test("carryTextSize moves the setting to another stylesheet (switching skins)", () => {
  const other = ":root {\n  --ink: #222;\n}\n";
  assert.equal(readTextSize(carryTextSize(writeTextSize(CSS, 93.75), other)), 93.75);
  assert.equal(carryTextSize(CSS, other), other);
});
