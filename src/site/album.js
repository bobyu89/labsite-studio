// The photo album of a site whose js/data.js lists its own photos:
//
//   const LOCAL_PHOTOS = [
//     { src: "assets/gallery/2026-06-15-eafons-1a2b3c.webp", caption: "2026-06-15 EAFONS 合影" },
//   ];
//
// The gallery page (and the home page's latest photos) render this list with
// the site's own script. Like siteData.js, the file is never evaluated: the
// array is read with a small parser and written back in the same shape, and
// everything outside the array stays byte for byte.

const START = /const\s+LOCAL_PHOTOS\s*=\s*\[/;
const KEYS = ["src", "thumb", "caption"];

// Index of the "]" closing the "[" at `open`, skipping strings and comments.
function closeOf(text, open) {
  let depth = 0;
  for (let i = open; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"' || ch === "'" || ch === "`") {
      for (i++; i < text.length && text[i] !== ch; i++) if (text[i] === "\\") i++;
    } else if (ch === "/" && text[i + 1] === "/") {
      i = text.indexOf("\n", i);
      if (i < 0) return -1;
    } else if (ch === "/" && text[i + 1] === "*") {
      i = text.indexOf("*/", i + 2);
      if (i < 0) return -1;
      i++;
    } else if (ch === "[") depth++;
    else if (ch === "]" && --depth === 0) return i;
  }
  return -1;
}

// Drops // and /* */ comments but not "//" inside strings (photo URLs).
function stripComments(s) {
  return s.replace(/("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')|\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, (m, str) => str || "");
}

const unquote =(s) => s.replace(/\\(.)/g, (_, c) => ({ n: "\n", t: "\t" })[c] ?? c);
const quote = (s) => '"' + String(s).replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\r?\n/g, " ") + '"';

// → { ok, photos: [{ src, thumb?, caption }], start, end, reason? }
// ok is false when the site has no LOCAL_PHOTOS, or lists photos in a way
// this editor would lose (computed values, other keys).
export function readAlbum(text) {
  const m = START.exec(String(text || ""));
  if (!m) return { ok: false, photos: [], reason: "missing" };
  const open = m.index + m[0].length - 1;
  const close = closeOf(text, open);
  if (close < 0) return { ok: false, photos: [], reason: "unparsed" };
  const body = stripComments(text.slice(open + 1, close));
  const photos = [];
  const rest = body.replace(/\{([^{}]*)\}/g, (_, inner) => {
    const photo = {};
    const left = inner.replace(/([A-Za-z_$][\w$]*)\s*:\s*(?:"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)')/g, (_, k, d, s) => {
      photo[k] = unquote(d ?? s);
      return "";
    });
    if (left.replace(/[\s,]/g, "") || !photo.src || Object.keys(photo).some((k) => !KEYS.includes(k))) photo.invalid = true;
    photos.push(photo);
    return "";
  });
  if (rest.replace(/[\s,]/g, "") || photos.some((p) => p.invalid)) return { ok: false, photos: [], reason: "unparsed" };
  return { ok: true, photos: photos.map((p) => ({ ...p, caption: p.caption || "" })), start: open, end: close + 1 };
}

// Replaces the array with `photos`, one object per line.
export function writeAlbum(text, photos) {
  const album = readAlbum(text);
  if (!album.ok) throw new Error("這個網站的 js/data.js 沒有可編輯的 LOCAL_PHOTOS 照片清單。");
  const line = (p) => "  { " + KEYS.filter((k) => p[k] || k === "caption").map((k) => k + ": " + quote(p[k] || "")).join(", ") + " }";
  const array = photos.length ? "[\n" + photos.map(line).join(",\n") + "\n]" : "[]";
  return text.slice(0, album.start) + array + text.slice(album.end);
}

// A first caption for a new photo: its file name when that means something,
// otherwise the day it was taken (the gallery sorts captions by a leading date).
export function defaultCaption(file) {
  const name = String(file?.name || "").replace(/\.[^.]+$/, "").trim();
  if (name && !/^(img|dsc|dscn|pxl|photo|image|mvimg|screenshot|line_)[\s_-]*\d/i.test(name) && !/^\d+$/.test(name)) return name;
  const t = file?.lastModified ? new Date(file.lastModified) : new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}`;
}

export const albumPath = (assetPath) => assetPath.replace(/^assets\//, "assets/gallery/");
