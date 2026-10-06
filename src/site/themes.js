// Site themes: a template's look lives in css/theme.css as CSS custom
// properties (plus the web-font @import). Every template shares the same
// markup, so a theme can be swapped without touching a single page. This
// module reads and patches that file in place, checks WCAG contrast, and
// generates new, contrast-safe themes.

export const THEME_PATH = "css/theme.css";

/* ------------------------------------------------------------ read / patch */
const DECL = /(--[a-z0-9-]+)\s*:\s*([^;{}]+?)\s*;/gi;
const IMPORT = /@import\s+url\(\s*["']?([^"')]+)["']?\s*\)\s*;/i;

// Custom properties declared in :root, in file order.
export function readTheme(text) {
  const root = String(text).match(/:root\s*\{([\s\S]*?)\}/);
  if (!root) return null;
  const vars = {};
  for (const m of root[1].matchAll(DECL)) vars[m[1]] = m[2].trim();
  if (!Object.keys(vars).length) return null;
  const imp = String(text).match(IMPORT);
  return { vars, fontUrl: imp ? imp[1] : null };
}

// Replaces values in place, so comments, order and unknown properties stay.
// Variables the file does not declare are ignored; a font URL replaces the
// existing @import (or is added at the top).
export function patchTheme(text, { vars = {}, fontUrl } = {}) {
  let out = String(text).replace(/(:root\s*\{)([\s\S]*?)(\})/, (all, open, body, close) => {
    const next = body.replace(DECL, (decl, name, value) =>
      Object.hasOwn(vars, name) ? decl.replace(value, String(vars[name]).replace(/[;{}]/g, "")) : decl,
    );
    return open + next + close;
  });
  if (fontUrl !== undefined) {
    const line = fontUrl ? `@import url("${fontUrl}");` : "";
    out = IMPORT.test(out) ? out.replace(IMPORT, line) : line ? line + "\n\n" + out : out;
  }
  return out;
}

/* ------------------------------------------------------------- contrast */
export function parseColor(value) {
  const v = String(value || "").trim().toLowerCase();
  let m = v.match(/^#([0-9a-f]{3})$/);
  if (m) return [...m[1]].map((c) => parseInt(c + c, 16));
  m = v.match(/^#([0-9a-f]{6})$/);
  if (m) return [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16));
  if (v === "white") return [255, 255, 255];
  if (v === "black") return [0, 0, 0];
  return null;
}
const channel = (c) => {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};
export function luminance(rgb) {
  const [r, g, b] = rgb.map(channel);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
export function contrast(a, b) {
  const ca = Array.isArray(a) ? a : parseColor(a);
  const cb = Array.isArray(b) ? b : parseColor(b);
  if (!ca || !cb) return null;
  const [hi, lo] = [luminance(ca), luminance(cb)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

// Pairs a template promises to keep readable: [foreground, background, label].
export const CONTRAST_PAIRS = [
  ["--on-zone", "--zone-research", "研究分區上的文字"],
  ["--on-zone", "--zone-team", "團隊分區上的文字"],
  ["--on-zone", "--zone-publications", "論文分區上的文字"],
  ["--on-join", "--zone-join", "招生色帶上的文字"],
  ["--ink", "--plate", "白色底的內文"],
  ["--ink", "--wall", "灰色底的內文"],
  ["--ink-soft", "--plate", "白色底的次要文字"],
  ["--ink-soft", "--wall", "灰色底的次要文字"],
  ["--zone-team", "--wall", "灰色底的團隊色文字"],
  ["--zone-publications", "--plate", "白色底的論文年份"],
];
// Every pair below 4.5:1 (WCAG 2.1 AA for body text). Pairs with a missing
// or non-hex variable are skipped.
export function contrastIssues(vars, pairs = CONTRAST_PAIRS) {
  const issues = [];
  for (const [fg, bg, label] of pairs) {
    const ratio = contrast(vars[fg], vars[bg]);
    if (ratio !== null && ratio < 4.5) issues.push({ fg, bg, label, ratio: Math.round(ratio * 100) / 100 });
  }
  return issues;
}

/* ------------------------------------------------------------- OKLCH */
// OKLCH → sRGB (Björn Ottosson's OKLab), clamped into gamut by chroma reduction.
function oklabToLinear(L, a, b) {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}
const toSrgb = (x) => (x <= 0.0031308 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - 0.055);
export function oklch(L, C, h) {
  for (let c = C; c >= 0; c -= 0.005) {
    const rad = (h * Math.PI) / 180;
    const lin = oklabToLinear(L, c * Math.cos(rad), c * Math.sin(rad));
    if (lin.every((v) => v >= -0.0005 && v <= 1.0005)) {
      return "#" + lin.map((v) => Math.round(Math.min(1, Math.max(0, toSrgb(v))) * 255).toString(16).padStart(2, "0")).join("");
    }
  }
  return oklch(L, 0, h);
}
// The lightest version of a hue that reads at 4.5:1 against every given
// background (white text on it, and it as text on the page grounds).
function darkEnough(h, C, startL, grounds) {
  for (let L = startL; L > 0.2; L -= 0.01) {
    const hex = oklch(L, C, h);
    if (grounds.every((g) => contrast(hex, g) >= 4.6)) return hex;
  }
  return oklch(0.25, C, h);
}
const MARK_HUE = 75;

/* ------------------------------------------------------------- generator */
// Font pairings: a Latin face first (so English uses it), then a Chinese face.
export const FONT_PAIRS = [
  { id: "signage", name: "導引標示", latin: "Overpass", zh: "Noto Sans TC", latinW: "400;600;700;800;900", zhW: "400;500;700;900" },
  { id: "legible", name: "高辨識", latin: "Atkinson Hyperlegible Next", zh: "Noto Sans TC", latinW: "400;600;700;800", zhW: "400;500;700;900" },
  { id: "highway", name: "公路標誌", latin: "Barlow", zh: "Noto Sans TC", latinW: "400;600;700;800;900", zhW: "400;500;700;900" },
  { id: "public", name: "公共設施", latin: "Public Sans", zh: "Noto Sans TC", latinW: "400;600;700;800;900", zhW: "400;500;700;900" },
  { id: "scholar", name: "書卷", latin: "Source Serif 4", zh: "Noto Serif TC", latinW: "400;600;700;900", zhW: "400;500;700;900" },
];
export function fontUrl(pair) {
  const fam = (name, w) => "family=" + name.replace(/ /g, "+") + ":wght@" + w;
  return `https://fonts.googleapis.com/css2?${fam(pair.zh, pair.zhW)}&${fam(pair.latin, pair.latinW)}&display=swap`;
}
export const fontStack = (pair) =>
  `"${pair.latin}", "${pair.zh}", "PingFang TC", "Microsoft JhengHei", ${/Serif/.test(pair.zh) ? "serif" : "sans-serif"}`;

const HUE_NAMES = [
  [15, "朱紅"], [45, "赭橙"], [75, "琥珀"], [105, "橄欖"], [150, "松綠"], [190, "青瓷"],
  [235, "湖藍"], [265, "靛青"], [300, "紫藤"], [340, "莓紅"], [361, "朱紅"],
];
export const hueName = (h) => HUE_NAMES.find(([max]) => ((h % 360) + 360) % 360 < max)[1];

// Four zone hues per scheme, from a base hue.
const SCHEMES = {
  wayfinding: { name: "導引四色", hues: (h) => [h, h + 100, h + 200, h + 280], C: 0.13 },
  analogous: { name: "鄰近色", hues: (h) => [h, h + 28, h - 28, h + 60], C: 0.12 },
  mono: { name: "單色", hues: (h) => [h, h, h, h + 40], C: 0.11, steps: [0.5, 0.38, 0.28] },
  duo: { name: "雙色", hues: (h) => [h, h + 180, h, h + 180], C: 0.12, steps: [0.52, 0.5, 0.36] },
};

// Small seeded PRNG so a "batch" can be reproduced.
function rng(seed) {
  let a = seed >>> 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function makeTheme({ hue, scheme = "wayfinding", font = FONT_PAIRS[0], radius = 4 }) {
  const s = SCHEMES[scheme];
  const ink = oklch(0.21, 0.015, hue);
  const wall = oklch(0.935, 0.008, hue);
  const grounds = ["#ffffff", wall];
  const hs = s.hues(hue).map((x) => ((x % 360) + 360) % 360);
  const safe = hs.slice(0, 3).map((h, i) => darkEnough(h, s.C, s.steps ? s.steps[i] : 0.62, grounds));
  // Amber is reserved for "you are here"; a join hue near it moves away.
  const joinHue = Math.abs(((hs[3] - MARK_HUE + 540) % 360) - 180) < 40 ? (hs[3] + 90) % 360 : hs[3];
  const join = darkEnough(joinHue, s.C + 0.02, 0.5, grounds);
  const vars = {
    "--zone-research": safe[0],
    "--zone-team": safe[1],
    "--zone-publications": safe[2],
    "--zone-join": join,
    "--on-zone": "#ffffff",
    "--on-join": "#ffffff",
    "--mark": oklch(0.8, 0.16, MARK_HUE),
    "--ink": ink,
    "--ink-soft": oklch(0.45, 0.02, hue),
    "--wall": wall,
    "--plate": "#ffffff",
    "--rule": oklch(0.84, 0.012, hue),
    "--font": fontStack(font),
    "--radius": radius + "px",
  };
  return {
    id: `${scheme}-${Math.round(hue)}-${font.id}-${radius}`,
    name: `${hueName(hue)}・${s.name}・${font.name}`,
    scheme,
    hue,
    font: font.id,
    vars,
    fontUrl: fontUrl(font),
  };
}

// `count` distinct, contrast-safe themes. Same seed, same batch. Base hues
// are spread evenly around the colour wheel (with a little jitter), and the
// schemes, fonts and corners rotate, so a batch never comes out all green.
export function generateThemes({ count = 6, seed = Date.now(), schemes = Object.keys(SCHEMES) } = {}) {
  const rand = rng(seed);
  const shuffle = (list) => list.map((x) => [rand(), x]).sort((a, b) => a[0] - b[0]).map(([, x]) => x);
  const order = { schemes: shuffle(schemes), fonts: shuffle(FONT_PAIRS), radii: shuffle([0, 4, 10]) };
  const start = rand() * 360;
  const out = [];
  const seen = new Set();
  for (let i = 0; out.length < count && i < count * 6; i++) {
    const theme = makeTheme({
      hue: Math.round((start + (i * 360) / count + (rand() - 0.5) * 24 + 360) % 360),
      scheme: order.schemes[i % order.schemes.length],
      font: order.fonts[i % order.fonts.length],
      radius: order.radii[i % order.radii.length],
    });
    if (seen.has(theme.name) || contrastIssues(theme.vars).length) continue;
    seen.add(theme.name);
    out.push(theme);
  }
  return out;
}
