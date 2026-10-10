// A site's cloud album (雲端相簿): albums of photos the site keeps in
// data/albums.json, shown anywhere on the site with two blocks:
//
//   單張照片   <section class="ls-block ls-photo-section"> … <figure class="ls-photo"><img …><figcaption>…
//   相簿展示   <section class="ls-block ls-album-section"> … <div class="ls-album" data-album="…" data-layout="grid">
//
// The album block is filled in by js/labsite-albums.js on the published site,
// so adding photos to an album updates every page that shows it. Both blocks
// are styled by css/labsite-blocks.css. The editor writes these two files
// (RUNTIME_FILES) whenever a page uses a block or the albums are saved.

export const ALBUMS_PATH = "data/albums.json";
export const ALBUM_JS = "js/labsite-albums.js";
export const BLOCKS_CSS = "css/labsite-blocks.css";
export const LAYOUTS = [
  ["grid", "方格"],
  ["carousel", "輪播"],
  ["masonry", "瀑布流"],
];

export function emptyAlbums() {
  return { version: 1, albums: [] };
}

// Lenient: unknown fields are dropped, photos without src are skipped.
export function parseAlbums(text) {
  let raw;
  try {
    raw = JSON.parse(text);
  } catch {
    return emptyAlbums();
  }
  const albums = (Array.isArray(raw?.albums) ? raw.albums : [])
    .filter((a) => a && typeof a.id === "string" && a.id)
    .map((a) => ({
      id: a.id,
      name: String(a.name || "未命名相簿").slice(0, 60),
      ...(typeof a.cover === "string" && a.cover ? { cover: a.cover } : {}),
      photos: (Array.isArray(a.photos) ? a.photos : [])
        .filter((p) => p && typeof p.src === "string" && p.src)
        .map((p) => ({ src: p.src, caption: String(p.caption || "") })),
    }));
  return { version: 1, albums };
}

export const serializeAlbums = (data) => JSON.stringify({ version: 1, albums: data.albums }, null, 2) + "\n";

export function newAlbumId(taken = []) {
  const used = new Set(taken);
  let id;
  do id = "album-" + Math.random().toString(36).slice(2, 8);
  while (used.has(id));
  return id;
}

export const albumAssetPath = (assetPath) => assetPath.replace(/^assets\//, "assets/albums/");
export const coverOf = (album) => album.cover || album.photos[0]?.src || null;

/* --------------------------------------------------------------- blocks */
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
// Relative way back to the site root from a page ("en/pi.html" → "../").
export const rootFrom = (pagePath) => "../".repeat((String(pagePath).match(/\//g) || []).length);

// Snippets use site-root paths; insertSection rebases them for the page.
export function photoBlock({ src, caption = "", alt = "" }) {
  return `<section class="ls-block ls-photo-section">
  <div class="ls-wrap">
    <figure class="ls-photo">
      <img src="${esc(src)}" alt="${esc(alt || caption)}" loading="lazy">
      <figcaption>${esc(caption || "照片說明")}</figcaption>
    </figure>
  </div>
</section>`;
}
export function albumBlock({ album, layout = "grid", title = "", text = "", pagePath = "" }) {
  return `<section class="ls-block ls-album-section">
  <div class="ls-wrap">
    <h2 class="ls-title">${esc(title || "相簿")}</h2>
    <p class="ls-text">${esc(text || "在這裡寫一段相簿的說明，例如活動的時間、地點與內容。")}</p>
    <div class="ls-album" data-album="${esc(album)}" data-layout="${esc(layout)}" data-base="${esc(rootFrom(pagePath))}"></div>
  </div>
</section>`;
}

export function textBlock({ title = "", text = "" } = {}) {
  return `<section class="ls-block ls-text-section">
  <div class="ls-wrap">
    <h2 class="ls-title">${esc(title || "標題")}</h2>
    <p class="ls-text">${esc(text || "在這裡輸入內容。")}</p>
  </div>
</section>`;
}

// Adds the blocks' stylesheet (and the album script) to a page's <head>.
export function ensureBlockAssets(doc, pagePath, { script = false } = {}) {
  const base = rootFrom(pagePath);
  const head = doc.head;
  const has = (sel, attr, file) => [...head.querySelectorAll(sel)].some((n) => (n.getAttribute(attr) || "").endsWith(file));
  const add = (el) => {
    const last = head.lastChild;
    const indent = last && last.nodeType === 3 ? last.nodeValue : "\n";
    head.append(doc.createTextNode("  "), el, doc.createTextNode(indent.includes("\n") ? "\n" : indent));
  };
  let changed = false;
  if (!has('link[rel~="stylesheet"]', "href", BLOCKS_CSS)) {
    const link = doc.createElement("link");
    link.setAttribute("rel", "stylesheet");
    link.setAttribute("href", base + BLOCKS_CSS);
    add(link);
    changed = true;
  }
  if (script && !has("script[src]", "src", ALBUM_JS)) {
    const s = doc.createElement("script");
    s.setAttribute("src", base + ALBUM_JS);
    s.setAttribute("defer", "");
    add(s);
    changed = true;
  }
  return changed;
}

/* -------------------------------------------------------------- runtime */
export const RUNTIME_VERSION = 1;

export const BLOCKS_CSS_TEXT = `/* LabSite 照片與相簿區塊 v${RUNTIME_VERSION}：由 LabSite 編輯器產生，更新時會被覆寫。 */
.ls-block {
  padding: clamp(32px, 6vw, 72px) 0;
}
.ls-wrap {
  width: min(1120px, 100% - 2 * clamp(16px, 4vw, 40px));
  margin-inline: auto;
}
.ls-title {
  margin: 0 0 clamp(16px, 2.5vw, 28px);
}
.ls-text {
  max-width: 72ch;
  margin: 0 0 clamp(16px, 2.5vw, 26px);
  line-height: 1.85;
  white-space: pre-line;
}
.ls-text-section .ls-text {
  margin-bottom: 0;
}
.ls-photo {
  margin: 0 auto;
  max-width: 900px;
}
.ls-photo img {
  display: block;
  width: 100%;
  height: auto;
  border-radius: 8px;
}
.ls-photo figcaption,
.ls-album figcaption {
  margin-top: 8px;
  font-size: 0.9em;
  line-height: 1.6;
  opacity: 0.78;
}
.ls-album-grid {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 14px;
}
.ls-album-masonry {
  list-style: none;
  margin: 0;
  padding: 0;
  columns: 3 220px;
  column-gap: 14px;
}
.ls-album-masonry li {
  break-inside: avoid;
  margin-bottom: 14px;
}
.ls-album-carousel {
  position: relative;
}
.ls-album-track {
  list-style: none;
  margin: 0;
  padding: 0 0 6px;
  display: flex;
  gap: 14px;
  overflow-x: auto;
  scroll-snap-type: x mandatory;
  scrollbar-width: thin;
}
.ls-album-track li {
  flex: 0 0 min(78%, 520px);
  scroll-snap-align: start;
}
.ls-album figure {
  margin: 0;
}
.ls-album-open {
  display: block;
  width: 100%;
  padding: 0;
  border: 0;
  background: none;
  cursor: zoom-in;
  border-radius: 8px;
  overflow: hidden;
}
.ls-album-open img {
  display: block;
  width: 100%;
  height: auto;
  transition: transform 0.4s ease;
}
.ls-album-grid .ls-album-open img {
  aspect-ratio: 1;
  object-fit: cover;
}
.ls-album-track .ls-album-open img {
  aspect-ratio: 3 / 2;
  object-fit: cover;
}
.ls-album-open:hover img {
  transform: scale(1.03);
}
.ls-album-open:focus-visible {
  outline: 3px solid currentColor;
  outline-offset: 3px;
}
.ls-album-nav {
  position: absolute;
  top: calc(50% - 22px);
  width: 44px;
  height: 44px;
  border-radius: 50%;
  border: 0;
  background: rgba(255, 255, 255, 0.92);
  color: #222;
  font-size: 22px;
  line-height: 1;
  cursor: pointer;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.18);
}
.ls-album-nav.prev {
  left: 8px;
}
.ls-album-nav.next {
  right: 8px;
}
.ls-album-empty {
  opacity: 0.7;
}
.ls-lightbox {
  position: fixed;
  inset: 0;
  z-index: 9999;
  background: rgba(10, 12, 12, 0.92);
  display: grid;
  grid-template-rows: 1fr auto;
  place-items: center;
  padding: 56px 64px 20px;
  color: #fff;
}
.ls-lightbox img {
  max-width: 100%;
  max-height: calc(100vh - 150px);
  object-fit: contain;
  border-radius: 4px;
}
.ls-lightbox p {
  margin: 12px 0 0;
  text-align: center;
  line-height: 1.6;
}
.ls-lightbox button {
  position: absolute;
  border: 0;
  background: rgba(255, 255, 255, 0.14);
  color: #fff;
  width: 48px;
  height: 48px;
  border-radius: 50%;
  font-size: 24px;
  cursor: pointer;
}
.ls-lightbox button:focus-visible {
  outline: 3px solid #fff;
}
.ls-lightbox .close {
  top: 12px;
  right: 12px;
}
.ls-lightbox .prev {
  left: 10px;
  top: calc(50% - 24px);
}
.ls-lightbox .next {
  right: 10px;
  top: calc(50% - 24px);
}
@media (max-width: 600px) {
  .ls-lightbox {
    padding: 56px 8px 16px;
  }
  .ls-lightbox .prev,
  .ls-lightbox .next {
    top: auto;
    bottom: 14px;
  }
}
@media (prefers-reduced-motion: reduce) {
  .ls-album-open img {
    transition: none;
  }
  .ls-album-track {
    scroll-behavior: auto;
  }
}
`;

// Plain ES5 so it runs on any site without a build step.
export const ALBUM_JS_TEXT = `/* LabSite 相簿 v${RUNTIME_VERSION}：由 LabSite 編輯器產生，更新時會被覆寫。
   把 <div class="ls-album" data-album="…" data-layout="grid|carousel|masonry">
   填上 data/albums.json 裡那本相簿的照片；點照片可放大瀏覽。 */
(function () {
  "use strict";
  var cache = {};
  function load(base) {
    if (window.__lsAlbums) return Promise.resolve(window.__lsAlbums);
    if (!cache[base])
      cache[base] = fetch(base + "data/albums.json", { cache: "no-cache" })
        .then(function (r) { return r.ok ? r.json() : null; })
        .catch(function () { return null; });
    return cache[base];
  }
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text) n.textContent = text;
    return n;
  }
  function item(photo, base, i, open) {
    var li = el("li");
    var fig = el("figure");
    var btn = el("button", "ls-album-open");
    btn.type = "button";
    btn.setAttribute("aria-label", (photo.caption || "照片") + "（放大）");
    var img = el("img");
    img.src = base + photo.src;
    img.alt = photo.caption || "";
    img.loading = "lazy";
    btn.appendChild(img);
    btn.addEventListener("click", function () { open(i, btn); });
    fig.appendChild(btn);
    if (photo.caption) fig.appendChild(el("figcaption", "", photo.caption));
    li.appendChild(fig);
    return li;
  }
  function lightbox(photos, base, start, back) {
    var i = start;
    var box = el("div", "ls-lightbox");
    box.setAttribute("role", "dialog");
    box.setAttribute("aria-modal", "true");
    box.setAttribute("aria-label", "照片");
    var img = el("img");
    var cap = el("p");
    var close = el("button", "close", "×");
    close.type = "button";
    close.setAttribute("aria-label", "關閉");
    var prev = el("button", "prev", "‹");
    prev.type = "button";
    prev.setAttribute("aria-label", "上一張");
    var next = el("button", "next", "›");
    next.type = "button";
    next.setAttribute("aria-label", "下一張");
    var fig = el("div");
    fig.appendChild(img);
    fig.appendChild(cap);
    box.appendChild(fig);
    box.appendChild(close);
    if (photos.length > 1) {
      box.appendChild(prev);
      box.appendChild(next);
    }
    function show() {
      var p = photos[i];
      img.src = base + p.src;
      img.alt = p.caption || "";
      cap.textContent = (p.caption ? p.caption + "　" : "") + (i + 1) + " / " + photos.length;
    }
    function go(d) {
      i = (i + d + photos.length) % photos.length;
      show();
    }
    function done() {
      document.removeEventListener("keydown", key);
      box.parentNode && box.parentNode.removeChild(box);
      document.body.style.overflow = "";
      if (back) back.focus();
    }
    function key(e) {
      if (e.key === "Escape") done();
      else if (e.key === "ArrowLeft") go(-1);
      else if (e.key === "ArrowRight") go(1);
    }
    close.addEventListener("click", done);
    prev.addEventListener("click", function () { go(-1); });
    next.addEventListener("click", function () { go(1); });
    box.addEventListener("click", function (e) { if (e.target === box) done(); });
    document.addEventListener("keydown", key);
    show();
    document.body.appendChild(box);
    document.body.style.overflow = "hidden";
    close.focus();
  }
  function render(node, data) {
    var base = node.getAttribute("data-base") || "";
    var id = node.getAttribute("data-album");
    var layout = node.getAttribute("data-layout") || "grid";
    var album = null;
    var list = (data && data.albums) || [];
    for (var k = 0; k < list.length; k++) if (list[k].id === id) album = list[k];
    node.innerHTML = "";
    if (!album || !album.photos || !album.photos.length) {
      node.appendChild(el("p", "ls-album-empty", album ? "這本相簿還沒有照片。" : ""));
      return;
    }
    var photos = album.photos;
    var open = function (i, btn) { lightbox(photos, base, i, btn); };
    if (layout === "carousel") {
      var wrap = el("div", "ls-album-carousel");
      var track = el("ul", "ls-album-track");
      for (var c = 0; c < photos.length; c++) track.appendChild(item(photos[c], base, c, open));
      wrap.appendChild(track);
      if (photos.length > 1) {
        var step = function (d) { track.scrollBy({ left: d * track.clientWidth * 0.8, behavior: "smooth" }); };
        var p = el("button", "ls-album-nav prev", "‹");
        p.type = "button";
        p.setAttribute("aria-label", "往前");
        p.addEventListener("click", function () { step(-1); });
        var n = el("button", "ls-album-nav next", "›");
        n.type = "button";
        n.setAttribute("aria-label", "往後");
        n.addEventListener("click", function () { step(1); });
        wrap.appendChild(p);
        wrap.appendChild(n);
      }
      node.appendChild(wrap);
      return;
    }
    var ul = el("ul", layout === "masonry" ? "ls-album-masonry" : "ls-album-grid");
    for (var g = 0; g < photos.length; g++) ul.appendChild(item(photos[g], base, g, open));
    node.appendChild(ul);
  }
  function start() {
    var nodes = document.querySelectorAll(".ls-album[data-album]");
    for (var i = 0; i < nodes.length; i++)
      (function (node) {
        load(node.getAttribute("data-base") || "").then(function (data) { render(node, data); });
      })(nodes[i]);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
`;

// Files a page with blocks needs: path → text.
export const RUNTIME_FILES = { [ALBUM_JS]: ALBUM_JS_TEXT, [BLOCKS_CSS]: BLOCKS_CSS_TEXT };
