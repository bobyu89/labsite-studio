// 配色 for sites that keep their colours in :root variables (the imported
// lab sites): pick one main colour, like Google Stitch, and the whole
// palette follows. Every colour keeps its own lightness (so text stays as
// readable as before) and moves by the same hue turn as the main colour;
// greys stay grey, tinted backgrounds turn with the rest.
//
// Picking only previews: a marked :root override at the end of the site's
// stylesheet. Applying replaces the old colour values with the new ones in
// every text file (stylesheets, pages, scripts, SVGs), so icons and logos
// that have colours written into them follow too, and removes the override.
import { oklch } from "./themes.js";

export const COLOR_PRESETS = [
  ["#0d6557", "森林綠"],
  ["#1f6feb", "海洋藍"],
  ["#263b80", "深靛藍"],
  ["#7668d8", "薰衣草紫"],
  ["#c7256d", "莓果紅"],
  ["#e05a8a", "櫻花粉"],
  ["#b8400e", "陶土橘"],
  ["#c47f1c", "琥珀黃"],
  ["#2aae9b", "薄荷綠"],
  ["#374151", "石墨灰"],
];
export const COLORS_FILE = "labsite/colors.json";
const START = "/* labsite:colors */";
const END = "/* labsite:colors:end */";
const BLOCK = /\n*\/\* labsite:colors \*\/[\s\S]*?\/\* labsite:colors:end \*\/\n?/;

/* ----------------------------------------------------------- colour math */
export function normHex(value) {
  const v = String(value || "").trim().toLowerCase();
  const m3 = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/.exec(v);
  if (m3) return "#" + m3[1] + m3[1] + m3[2] + m3[2] + m3[3] + m3[3];
  return /^#[0-9a-f]{6}$/.test(v) ? v : null;
}
const rgbOf = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const lin = (c) => ((c /= 255) <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
export function toOklch(hex) {
  const [r, g, b] = rgbOf(normHex(hex)).map(lin);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const a = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  return [L, Math.hypot(a, B), ((Math.atan2(B, a) * 180) / Math.PI + 360) % 360];
}

/* ------------------------------------------------------------ the palette */
function rootBlock(css) {
  const text = String(css || "").replace(BLOCK, "\n");
  const m = /:root\s*\{([\s\S]*?)\}/.exec(text);
  return m ? m[1] : "";
}
// The :root declarations, in order: [{ name, value, label }] (label = the
// comment after the declaration, e.g. "主品牌 深藍靛").
export function readDeclarations(css) {
  const out = [];
  for (const m of rootBlock(css).matchAll(/(--[\w-]+)\s*:\s*([^;]+);[ \t]*(?:\/\*\s*([^*]*?)\s*\*\/)?/g)) out.push({ name: m[1], value: m[2].trim(), label: (m[3] || "").split(/[—–-]/)[0].trim() });
  return out;
}
// The colour variables (hex values) with how much each is used; the main
// colour is the most used clearly coloured one.
export function readPalette(css) {
  const decls = readDeclarations(css);
  const uses = (name) => (String(css).match(new RegExp("var\\(" + name.replace(/[-]/g, "\\-") + "\\)", "g")) || []).length;
  const colors = decls
    .filter((d) => normHex(d.value))
    .map((d) => {
      const [L, C, h] = toOklch(d.value);
      return { ...d, value: normHex(d.value), L, C, h, uses: uses(d.name) };
    });
  const chromatic = colors.filter((c) => c.C >= 0.06);
  const primary = chromatic.sort((a, b) => b.uses - a.uses || b.C - a.C)[0] || null;
  return { colors: colors.sort((a, b) => decls.findIndex((d) => d.name === a.name) - decls.findIndex((d) => d.name === b.name)), primary };
}

// { oldHex: newHex } for every colour that changes when the main colour becomes `seed`.
export function recolorMap(palette, seed) {
  const target = normHex(seed);
  if (!palette.primary || !target) return {};
  const [, sC, sH] = toOklch(target);
  const p = palette.primary;
  const turn = sH - p.h;
  const gain = sC / Math.max(p.C, 0.01);
  const map = {};
  for (const c of palette.colors) {
    let next;
    if (c.C >= 0.06) next = oklch(c.L, Math.min(0.37, c.C * gain), (c.h + turn + 360) % 360);
    else if (c.L > 0.85 && c.C >= 0.004) next = oklch(c.L, c.C, (c.h + turn + 360) % 360); // tinted grounds
    else continue; // greys, white, text colours: stay neutral
    if (next !== c.value) map[c.value] = next;
  }
  return map;
}

// Replaces colour values in any text: #rgb / #rrggbb, and rgb()/rgba() of them.
export function applyColorMap(text, map) {
  let count = 0;
  const keys = Object.keys(map);
  if (!keys.length) return { text: String(text), count };
  let out = String(text).replace(/#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/g, (m) => {
    const n = normHex(m);
    if (!n || !map[n]) return m;
    count++;
    const v = map[n];
    return m === m.toUpperCase() ? v.toUpperCase() : v;
  });
  const byRgb = Object.fromEntries(keys.map((k) => [rgbOf(k).join(","), rgbOf(map[k])]));
  out = out.replace(/rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})(\s*,[^)]*)?\)/g, (m, r, g, b, rest) => {
    const to = byRgb[[r, g, b].join(",")];
    if (!to) return m;
    count++;
    return (rest ? "rgba(" : "rgb(") + to.join(", ") + (rest || "") + ")";
  });
  return { text: out, count };
}

/* -------------------------------------------------------------- preview */
// The marked :root override: every declaration whose value changes.
export function previewBlock(css, map) {
  const lines = readDeclarations(css)
    .map((d) => [d.name, applyColorMap(d.value, map).text, d.value])
    .filter(([, next, old]) => next !== old)
    .map(([name, next]) => `  ${name}: ${next};`);
  return lines.length ? `${START}\n:root {\n${lines.join("\n")}\n}\n${END}\n` : "";
}
export function writePreview(css, map) {
  const had = BLOCK.test(String(css || ""));
  const clean = had ? String(css).replace(BLOCK, "\n").replace(/\n+$/, "\n") : String(css || "");
  const block = previewBlock(clean, map);
  return block ? clean.replace(/\n*$/, "\n") + "\n" + block : clean;
}
export const hasPreview = (css) => BLOCK.test(String(css || ""));
export const stripPreview = (css) => (hasPreview(css) ? String(css).replace(BLOCK, "\n").replace(/\n+$/, "\n") : String(css || ""));

// The original palette, remembered the first time colours are applied, so
// 恢復原本配色 can map the current colours back.
export function colorsRecord(existing, palette) {
  if (existing?.original) return existing;
  return { version: 1, original: Object.fromEntries(palette.colors.map((c) => [c.name, c.value])) };
}
export function restoreMap(record, palette) {
  const map = {};
  for (const c of palette.colors) {
    const was = normHex(record?.original?.[c.name]);
    if (was && was !== c.value) map[c.value] = was;
  }
  return map;
}
