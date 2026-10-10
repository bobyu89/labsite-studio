// Images teachers upload: phone photos are often 4000 px and 5 MB. Before an
// image is staged for saving, the browser scales it down and re-encodes it
// as WebP, and names it after its content so two different photos called
// IMG_0001.jpg can never overwrite each other.

export const MAX_EDGE = 1600;
export const MAX_INPUT_BYTES = 20 * 1024 * 1024;
export const ACCEPTED = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/svg+xml", "image/avif", "image/bmp"];
// What file pickers offer: every image (so nothing is hidden in the dialog),
// plus iPhone photos, which Windows does not label as images.
export const PICKER_ACCEPT = "image/*,.heic,.heif";
const IMAGE_EXT = /\.(png|jpe?g|webp|gif|svg|avif)$/i;
export const isImagePath = (p) => IMAGE_EXT.test(p);
const HEIC = /\.(heic|heif)$/i;
export const isHeic = (file) => /^image\/hei[cf]/.test(file.type) || HEIC.test(file.name || "");
// Chrome and Edge cannot decode HEIC, so a small converter is loaded from the
// CDN the first time someone picks an iPhone photo (Safari decodes it itself).
const HEIC_LIB = "https://cdn.jsdelivr.net/npm/heic2any@0.0.4/dist/heic2any.min.js";
let heicLib = null;
function loadHeicLib() {
  if (globalThis.heic2any) return Promise.resolve(globalThis.heic2any);
  heicLib ||= new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = HEIC_LIB;
    s.onload = () => (globalThis.heic2any ? resolve(globalThis.heic2any) : reject(new Error("heic2any")));
    s.onerror = () => {
      heicLib = null;
      reject(new Error("heic2any"));
    };
    document.head.appendChild(s);
  });
  return heicLib;
}
const HEIC_HELP =
  "這張是 iPhone 的 HEIC 照片，瀏覽器無法讀取。請在 iPhone「設定 › 相機 › 格式」選「最相容」，或把照片另存成 JPG 後再上傳。";
// HEIC → JPEG File, so the rest of the pipeline sees an ordinary photo.
async function fromHeic(file) {
  try {
    const bitmap = await createImageBitmap(file);
    bitmap.close?.();
    return file; // Safari: decodable as is
  } catch {
    /* convert below */
  }
  try {
    const convert = await loadHeicLib();
    const out = await convert({ blob: file, toType: "image/jpeg", quality: 0.9 });
    const blob = Array.isArray(out) ? out[0] : out;
    return new File([blob], (file.name || "photo").replace(HEIC, "") + ".jpg", { type: "image/jpeg" });
  } catch {
    throw new Error(HEIC_HELP);
  }
}

// "IMG 0001 (2).JPG" + hash → "img-0001-2-1a2b3c.webp". Non-Latin names keep
// their letters (Chinese file names are fine on every source).
export function assetName(originalName, hashHex, ext) {
  const base = String(originalName || "image")
    .replace(/\.[^.]+$/, "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "image";
  return `assets/${base}-${String(hashHex).slice(0, 6)}.${ext}`;
}

export async function sha256Hex(bytes) {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Target size that keeps the aspect ratio and fits MAX_EDGE on the long side.
export function fitWithin(width, height, maxEdge = MAX_EDGE) {
  const scale = Math.min(1, maxEdge / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

// → { blob, path, width, height, before, after, converted }
// SVG and GIF (possibly animated) are kept as they are; everything else is
// scaled and re-encoded as WebP, unless that would come out larger.
export async function prepareImage(file, { maxEdge = MAX_EDGE } = {}) {
  if (file.size > MAX_INPUT_BYTES) throw new Error("圖片超過 20 MB，請先用手機或電腦縮小一點。");
  if (isHeic(file)) file = await fromHeic(file);
  if (!ACCEPTED.includes(file.type))
    throw new Error(`「${file.name || "這個檔案"}」不是可以用的圖片。請用 JPG、PNG、WebP、GIF、SVG，或 iPhone 的 HEIC 照片。`);
  const original = new Uint8Array(await file.arrayBuffer());
  const keep = async () => {
    const ext = (file.name.match(/\.([a-z0-9]+)$/i)?.[1] || file.type.split("/")[1]).toLowerCase().replace("jpeg", "jpg").replace("svg+xml", "svg");
    return { blob: file, path: assetName(file.name, await sha256Hex(original), ext), before: file.size, after: file.size, converted: false };
  };
  if (file.type === "image/svg+xml" || file.type === "image/gif") return keep();
  let bitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return keep(); // a format this browser cannot decode: upload as is
  }
  const size = fitWithin(bitmap.width, bitmap.height, maxEdge);
  const canvas = typeof OffscreenCanvas !== "undefined" ? new OffscreenCanvas(size.width, size.height) : Object.assign(document.createElement("canvas"), size);
  canvas.getContext("2d").drawImage(bitmap, 0, 0, size.width, size.height);
  bitmap.close?.();
  const webp = canvas.convertToBlob
    ? await canvas.convertToBlob({ type: "image/webp", quality: 0.82 })
    : await new Promise((resolve) => canvas.toBlob(resolve, "image/webp", 0.82));
  if (!webp || webp.type !== "image/webp" || webp.size >= file.size) return { ...(await keep()), width: size.width, height: size.height };
  const bytes = new Uint8Array(await webp.arrayBuffer());
  return {
    blob: webp,
    path: assetName(file.name, await sha256Hex(bytes), "webp"),
    width: size.width,
    height: size.height,
    before: file.size,
    after: webp.size,
    converted: true,
  };
}

export const formatBytes = (n) => (n >= 1024 * 1024 ? (n / 1024 / 1024).toFixed(1) + " MB" : Math.max(1, Math.round(n / 1024)) + " KB");

// Which files the given pages and stylesheets reference (resolved to site
// paths): src, srcset, poster and href in HTML (favicons, linked images), and
// url(...) in CSS. Anything listed here must not be offered for deletion.
export function referencedImages(pages, resolve) {
  const used = new Set();
  for (const [pagePath, text] of Object.entries(pages)) {
    for (const m of String(text).matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/gi)) {
      const p = resolve(pagePath, m[1]);
      if (p) used.add(p);
    }
    const html = text;
    for (const m of String(html).matchAll(/\s(?:src|poster|href)=["']([^"']+)["']/gi)) {
      const p = resolve(pagePath, m[1]);
      if (p) used.add(p);
    }
    // Photo lists in js/data.js: { src: "assets/…", thumb: "…" }
    for (const m of String(html).matchAll(/\b(?:src|thumb)\s*:\s*["']([^"']+)["']/g)) {
      const p = resolve(pagePath, m[1]);
      if (p) used.add(p);
    }
    for (const m of String(html).matchAll(/srcset=["']([^"']+)["']/gi))
      for (const part of m[1].split(",")) {
        const p = resolve(pagePath, part.trim().split(/\s+/)[0]);
        if (p) used.add(p);
      }
  }
  return used;
}
