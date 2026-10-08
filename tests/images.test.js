// Image uploads: content-hashed names, scaling maths, which images pages use,
// and deleting through a sequential source.
import test from "node:test";
import assert from "node:assert/strict";
import { assetName, fitWithin, referencedImages, isImagePath, sha256Hex, formatBytes } from "../src/site/images.js";
import { resolveFrom, sequentialWriter } from "../src/site/source.js";

test("assetName: readable, content-hashed, never collides on the same file name", () => {
  assert.equal(assetName("IMG 0001 (2).JPG", "1a2b3c4d", "webp"), "assets/img-0001-2-1a2b3c.webp");
  assert.equal(assetName("研究室合照.png", "abcdef12", "webp"), "assets/研究室合照-abcdef.webp");
  assert.equal(assetName("...", "000000", "png"), "assets/image-000000.png");
  assert.notEqual(assetName("IMG_0001.jpg", "aaaaaa", "webp"), assetName("IMG_0001.jpg", "bbbbbb", "webp"));
  assert.ok(assetName("x".repeat(200) + ".jpg", "123456", "webp").length < 60);
});

test("fitWithin keeps the aspect ratio and only scales down", () => {
  assert.deepEqual(fitWithin(4032, 3024), { width: 1600, height: 1200 });
  assert.deepEqual(fitWithin(3024, 4032), { width: 1200, height: 1600 });
  assert.deepEqual(fitWithin(800, 600), { width: 800, height: 600 });
});

test("sha256Hex and formatBytes", async () => {
  assert.equal(await sha256Hex(new TextEncoder().encode("abc")), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  assert.equal(formatBytes(512), "1 KB");
  assert.equal(formatBytes(5 * 1024 * 1024), "5.0 MB");
});

test("referencedImages resolves src, srcset and en/ relative paths", () => {
  const used = referencedImages(
    {
      "index.html": '<img src="assets/a.webp"><img src="https://x/y.png"><source srcset="assets/b.webp 1x, assets/c.webp 2x">',
      "en/index.html": '<img class="x" src="../assets/d.webp" alt=""><link rel="icon" href="../assets/favicon.svg">',
      "css/site.css": ".hero{background:url('../assets/bg.jpg')}",
    },
    resolveFrom,
  );
  for (const p of ["assets/a.webp", "assets/b.webp", "assets/c.webp", "assets/d.webp", "assets/favicon.svg", "assets/bg.jpg"])
    assert.ok(used.has(p), p);
  assert.ok(![...used].some((p) => p.includes("https")));
  assert.ok(isImagePath("assets/x.WEBP"));
  assert.ok(!isImagePath("assets/x.pdf"));
});

test("sequentialWriter deletes when the source can, refuses otherwise", async () => {
  const log = [];
  const w = sequentialWriter(async (p) => log.push("text " + p), async (p) => log.push("blob " + p), async (p) => log.push("delete " + p));
  await w([{ path: "a.html", text: "x" }, { path: "assets/old.png", delete: true }]);
  assert.deepEqual(log, ["text a.html", "delete assets/old.png"]);
  const noDelete = sequentialWriter(async () => {}, async () => {});
  await assert.rejects(() => noDelete([{ path: "x.png", delete: true }]), /無法刪除/);
});
