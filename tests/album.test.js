// Activity album (LOCAL_PHOTOS in js/data.js) and member photo slots.
import test from "node:test";
import assert from "node:assert/strict";
import "./dom.js";
import { readAlbum, writeAlbum, defaultCaption, albumPath } from "../src/site/album.js";
import { referencedImages, isHeic, PICKER_ACCEPT } from "../src/site/images.js";
const { parsePage, serializePage, sectionElements, describeNode, describeItem, setAttribute, collectFields } = await import("../src/site/page.js");

const DATA = `const SITE = { nameZh: "研究室" };

/* 本地照片清單 — 範例：{ src: "assets/gallery/a.jpg", caption: "a" } */
const LOCAL_PHOTOS = [];

const FALLBACK_PHOTOS = [
  { src: "assets/placeholder-1.svg", thumb: "assets/placeholder-1.svg", caption: "佔位 1" }
];
`;

test("readAlbum: empty list, and the surrounding file is kept byte for byte", () => {
  const a = readAlbum(DATA);
  assert.equal(a.ok, true);
  assert.deepEqual(a.photos, []);
  const text = writeAlbum(DATA, [
    { src: "assets/gallery/x-1a2b3c.webp", caption: '2026-06-15 "EAFONS" 合影' },
    { src: "https://drive.google.com/thumbnail?id=1", thumb: "https://example.org/t.jpg", caption: "" },
  ]);
  assert.equal(text.slice(0, DATA.indexOf("const LOCAL_PHOTOS")), DATA.slice(0, DATA.indexOf("const LOCAL_PHOTOS")));
  assert.ok(text.endsWith(DATA.slice(DATA.indexOf("const FALLBACK_PHOTOS") - 2)));
  const back = readAlbum(text);
  assert.equal(back.ok, true);
  assert.deepEqual(back.photos, [
    { src: "assets/gallery/x-1a2b3c.webp", caption: '2026-06-15 "EAFONS" 合影' },
    { src: "https://drive.google.com/thumbnail?id=1", thumb: "https://example.org/t.jpg", caption: "" },
  ]);
  assert.equal(writeAlbum(text, []), DATA);
});

test("readAlbum: comments and single quotes are read; anything else is left alone", () => {
  const ok = readAlbum(`const LOCAL_PHOTOS = [
    // 六月
    { src: 'assets/gallery/a.jpg', caption: 'A' }, /* 七月 */ { src: "assets/b.jpg" },
  ];`);
  assert.equal(ok.ok, true);
  assert.deepEqual(ok.photos.map((p) => p.src), ["assets/gallery/a.jpg", "assets/b.jpg"]);
  assert.equal(readAlbum(`const LOCAL_PHOTOS = photos.map(f);`).ok, false);
  assert.equal(readAlbum(`const LOCAL_PHOTOS = [{ src: base + "a.jpg" }];`).ok, false);
  assert.equal(readAlbum(`const LOCAL_PHOTOS = [{ src: "a.jpg", width: "3" }];`).ok, false);
  assert.equal(readAlbum(`const SITE = {};`).reason, "missing");
  assert.throws(() => writeAlbum(`const SITE = {};`, []), /LOCAL_PHOTOS/);
});

test("defaultCaption and albumPath", () => {
  assert.equal(defaultCaption({ name: "2026-06-15 EAFONS 合影.jpg" }), "2026-06-15 EAFONS 合影");
  assert.equal(defaultCaption({ name: "IMG_4821.JPG", lastModified: new Date(2026, 8, 20).getTime() }), "2026-09-20");
  assert.equal(defaultCaption({ name: "PXL_20260920_101010.jpg", lastModified: new Date(2026, 0, 2).getTime() }), "2026-01-02");
  assert.equal(albumPath("assets/eafons-1a2b3c.webp"), "assets/gallery/eafons-1a2b3c.webp");
});

test("album photos count as used images (photo library will not offer them for deletion)", () => {
  const used = referencedImages({ "js/data.js": `const LOCAL_PHOTOS = [\n  { src: "assets/gallery/a-1.webp", thumb: "assets/gallery/a-t.webp", caption: "" }\n];` }, (from, p) => p);
  assert.ok(used.has("assets/gallery/a-1.webp"));
  assert.ok(used.has("assets/gallery/a-t.webp"));
});

const MEMBERS = `<!DOCTYPE html>
<html><head></head><body>
<section class="section">
  <div class="member-grid">
    <div class="card member-card">
      <div class="member-card__head">
        <span class="avatar member-card__avatar">游</span>
        <div>
          <h3 class="member-card__name">游明勳</h3>
          <p class="member-card__role">碩士班研究生</p>
        </div>
      </div>
    </div>
    <div class="card member-card">
      <div class="member-card__head">
        <img class="avatar member-card__avatar" src="assets/li.jpg" alt="李妍鋅 照片">
        <div>
          <h3 class="member-card__name">李妍鋅</h3>
          <p class="member-card__role">碩士班研究生</p>
        </div>
      </div>
    </div>
  </div>
</section>
</body></html>`;

test("an avatar showing an initial is a photo slot; putting a photo in makes it an <img>", () => {
  const page = parsePage(MEMBERS);
  const section = sectionElements(page.doc)[0];
  const list = describeNode(section, section).lists[0];
  assert.equal(list.items.length, 2);
  const first = describeItem(section, list.items[0].path).fields;
  const slot = first.find((f) => f.kind === "image");
  assert.equal(slot.slot, true);
  assert.equal(slot.initial, "游");
  assert.ok(!first.some((f) => f.kind === "text" && f.value === "游"), "the initial is not offered as text");
  assert.equal(setAttribute(section, slot.path, "src", "assets/yu-1a2b3c.webp"), true);
  const out = serializePage(page);
  // (linkedom lists new attributes in a different order than browsers do)
  const img = out.match(/<img [^>]*yu-1a2b3c[^>]*>/)[0];
  assert.match(img, /class="avatar member-card__avatar"/);
  assert.match(img, /src="assets\/yu-1a2b3c\.webp"/);
  assert.match(img, /alt="游明勳 照片"/);
  assert.ok(!out.includes(">游</span>"));
  // Everything else is untouched.
  assert.equal(out.replace(img, '<span class="avatar member-card__avatar">游</span>'), MEMBERS);
  // A real photo stays an ordinary image field.
  const second = describeItem(section, list.items[1].path).fields.find((f) => f.kind === "image");
  assert.ok(!second.slot);
  assert.equal(second.src, "assets/li.jpg");
});

test("only short initials in avatar-like elements are photo slots", () => {
  const { doc } = parsePage(`<html><body><section>
    <span class="avatar">王小明的介紹文字</span>
    <span class="badge">新</span>
    <div class="avatar"><svg></svg></div>
  </section></body></html>`);
  const fields = collectFields(sectionElements(doc)[0]);
  assert.ok(!fields.some((f) => f.slot));
});

test("iPhone photos are recognised, and pickers offer every image", () => {
  assert.equal(isHeic({ name: "IMG_0001.HEIC", type: "" }), true);
  assert.equal(isHeic({ name: "a.jpg", type: "image/heif" }), true);
  assert.equal(isHeic({ name: "a.jpg", type: "image/jpeg" }), false);
  assert.match(PICKER_ACCEPT, /image\/\*/);
  assert.match(PICKER_ACCEPT, /\.heic/);
});
