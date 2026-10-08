// Images teachers upload: phone photos are often 4000 px and 5 MB. Before an
// image is staged for saving, the browser scales it down and re-encodes it
// as WebP, and names it after its content so two different photos called
// IMG_0001.jpg can never overwrite each other.

export const MAX_EDGE = 1600;
export const MAX_INPUT_BYTES = 20 * 1024 * 1024;
export const ACCEPTED = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/svg+xml"];
const IMAGE_EXT = /\.(png|jpe?g|webp|gif|svg|avif)$/i;
export const isImagePath = (p) => IMAGE_EXT.test(p);

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
  if (!ACCEPTED.includes(file.type)) throw new Error("請使用 JPG、PNG、WebP、GIF 或 SVG 圖片。");
  if (file.size > MAX_INPUT_BYTES) throw new Error("圖片超過 20 MB，請先用手機或電腦縮小一點。");
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
    for (const m of String(html).matchAll(/srcset=["']([^"']+)["']/gi))
      for (const part of m[1].split(",")) {
        const p = resolve(pagePath, part.trim().split(/\s+/)[0]);
        if (p) used.add(p);
      }
  }
  return used;
}
