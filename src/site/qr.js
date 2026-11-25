// 海報用 QR Code: a page's public address as an SVG (crisp at any print
// size) or a large PNG. qrcode-generator (MIT) does the encoding.
import qrcode from "qrcode-generator";

// Error correction "M" survives a small logo or a smudge on a poster.
export function qrMatrix(text) {
  const qr = qrcode(0, "M");
  qr.addData(String(text), "Byte");
  qr.make();
  const n = qr.getModuleCount();
  return Array.from({ length: n }, (_, r) => Array.from({ length: n }, (_, c) => qr.isDark(r, c)));
}

// → an SVG document; margin in modules (4 is the standard quiet zone).
export function qrSvg(text, { margin = 4, color = "#000000" } = {}) {
  const m = qrMatrix(text);
  const n = m.length + margin * 2;
  let d = "";
  m.forEach((row, r) => row.forEach((dark, c) => dark && (d += `M${c + margin} ${r + margin}h1v1h-1z`)));
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n} ${n}" shape-rendering="crispEdges"><rect width="${n}" height="${n}" fill="#ffffff"/><path d="${d}" fill="${color}"/></svg>`;
}

// The public address of a page: index.html is the folder itself.
export function publicPageUrl(siteUrl, page) {
  const base = String(siteUrl || "").replace(/\/?$/, "/");
  const path = String(page || "").replace(/(^|\/)index\.html?$/i, "$1");
  return base + path.split("/").map(encodeURIComponent).join("/").replace(/%2F/g, "/");
}
