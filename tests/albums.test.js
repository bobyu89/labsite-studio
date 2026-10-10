// Cloud album: data/albums.json, the photo/album/text blocks and their runtime.
import test from "node:test";
import assert from "node:assert/strict";
import "./dom.js";
import {
  parseAlbums,
  serializeAlbums,
  emptyAlbums,
  newAlbumId,
  albumAssetPath,
  coverOf,
  photoBlock,
  albumBlock,
  textBlock,
  rootFrom,
  RUNTIME_FILES,
  ALBUM_JS,
  BLOCKS_CSS,
} from "../src/site/albums.js";
import { referencedImages } from "../src/site/images.js";
const { parsePage, serializePage, sectionElements, insertSection, setAttribute, readHead, writeHead, collectFields } = await import("../src/site/page.js");
const { ensureBlockAssets } = await import("../src/site/albums.js");

test("parseAlbums keeps only what the editor understands; serialize round-trips", () => {
  const data = parseAlbums(
    JSON.stringify({
      version: 1,
      albums: [
        { id: "a1", name: "EAFONS", cover: "assets/albums/b.webp", extra: 1, photos: [{ src: "assets/albums/a.webp", caption: "合影", x: 2 }, { caption: "沒有檔案" }] },
        { name: "沒有 id" },
      ],
    }),
  );
  assert.deepEqual(data, { version: 1, albums: [{ id: "a1", name: "EAFONS", cover: "assets/albums/b.webp", photos: [{ src: "assets/albums/a.webp", caption: "合影" }] }] });
  assert.deepEqual(parseAlbums(serializeAlbums(data)), data);
  assert.deepEqual(parseAlbums("{"), emptyAlbums());
  assert.equal(coverOf(data.albums[0]), "assets/albums/b.webp");
  assert.equal(coverOf({ photos: [{ src: "x" }] }), "x");
  assert.equal(albumAssetPath("assets/p-1a2b3c.webp"), "assets/albums/p-1a2b3c.webp");
  assert.ok(!["a"].includes(newAlbumId(["a"])));
});

test("album photos count as used (JSON keys are quoted)", () => {
  const used = referencedImages({ "data/albums.json": serializeAlbums({ albums: [{ id: "a", name: "A", cover: "assets/c.webp", photos: [{ src: "assets/albums/p.webp", caption: "" }] }] }) }, (from, p) => p);
  assert.ok(used.has("assets/albums/p.webp"));
  assert.ok(used.has("assets/c.webp"));
});

const PAGE = `<!DOCTYPE html>
<html lang="zh-Hant">
<head>
  <meta charset="utf-8">
  <title>成員</title>
  <link rel="stylesheet" href="../css/main.css">
</head>
<body>
  <section class="hero"><h1>團隊</h1></section>
  <footer>f</footer>
</body>
</html>`;

test("blocks insert on an English page with paths back to the site root, assets added once", () => {
  const page = parsePage(PAGE);
  assert.equal(insertSection(page.doc, 0, photoBlock({ src: "assets/albums/p.webp", caption: "合影" }), "en/members.html"), true);
  assert.equal(insertSection(page.doc, 1, albumBlock({ album: "a1", layout: "carousel", title: "相簿", text: "說明", pagePath: "en/members.html" }), "en/members.html"), true);
  assert.equal(insertSection(page.doc, 2, textBlock({ title: "標題", text: "內容" }), "en/members.html"), true);
  assert.equal(ensureBlockAssets(page.doc, "en/members.html", { script: true }), true);
  assert.equal(ensureBlockAssets(page.doc, "en/members.html", { script: true }), false, "not twice");
  const out = serializePage(page);
  assert.match(out, /<img src="\.\.\/assets\/albums\/p\.webp" alt="合影" loading="lazy">/);
  assert.match(out, /data-album="a1" data-layout="carousel" data-base="\.\.\/"/);
  // (linkedom lists new attributes in reverse order; browsers keep it)
  assert.match(out, /<link (?=[^>]*rel="stylesheet")(?=[^>]*href="\.\.\/css\/labsite-blocks\.css")[^>]*>/);
  assert.match(out, /<script (?=[^>]*defer)(?=[^>]*src="\.\.\/js\/labsite-albums\.js")[^>]*><\/script>/);
  assert.equal(sectionElements(page.doc).length, 4);
  // Title and text of the album block are ordinary editable fields.
  const fields = collectFields(sectionElements(page.doc)[2]).filter((f) => f.kind === "text").map((f) => f.value);
  assert.deepEqual(fields, ["相簿", "說明"]);
  assert.equal(rootFrom("index.html"), "");
});

test("album and layout of a block can be changed; other data attributes cannot", () => {
  const page = parsePage(PAGE);
  insertSection(page.doc, 0, albumBlock({ album: "a1" }), "index.html");
  const section = sectionElements(page.doc)[1];
  const albumEl = section.querySelector(".ls-album");
  const path = [...albumEl.parentNode.childNodes].indexOf(albumEl);
  const { pathOf } = { pathOf: (el) => { const out = []; for (let n = el; n !== section; n = n.parentNode) out.unshift([...n.parentNode.childNodes].indexOf(n)); return out; } };
  assert.ok(path >= 0);
  assert.equal(setAttribute(section, pathOf(albumEl), "data-layout", "masonry"), true);
  assert.equal(setAttribute(section, pathOf(albumEl), "data-album", "a2"), true);
  assert.equal(albumEl.getAttribute("data-layout"), "masonry");
  assert.equal(setAttribute(section, pathOf(section.querySelector("h2")), "data-album", "x"), false);
});

test("share image: og:image and twitter:image, added when missing", () => {
  const page = parsePage(PAGE.replace("<title>成員</title>", '<title>成員</title>\n  <meta name="description" content="d">'));
  assert.equal(readHead(page.doc).image, null);
  writeHead(page.doc, { image: "https://example.org/s/assets/albums/p.webp" });
  assert.equal(readHead(page.doc).image, "https://example.org/s/assets/albums/p.webp");
  assert.match(serializePage(page), /<meta name="description" content="d">\n  <meta (?=[^>]*property="og:image")(?=[^>]*content="https:\/\/example\.org\/s\/assets\/albums\/p\.webp")[^>]*>/);
});

test("runtime files are versioned, self-contained and ES5-safe", () => {
  assert.deepEqual(Object.keys(RUNTIME_FILES).sort(), [BLOCKS_CSS, ALBUM_JS].sort());
  const js = RUNTIME_FILES[ALBUM_JS];
  assert.match(js, /LabSite 相簿 v\d+/);
  assert.ok(!/=>|\blet\b|\bconst\b|`/.test(js.replace(/\/\*[\s\S]*?\*\//g, "")), "plain ES5");
  new Function(js); // parses
  assert.match(RUNTIME_FILES[BLOCKS_CSS], /prefers-reduced-motion/);
});
