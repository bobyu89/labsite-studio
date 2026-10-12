// 素材庫: images a teacher can put anywhere an image goes, without hunting
// for them elsewhere. Everything here may be bundled and redistributed:
//   醫療護理圖示  Health Icons (MIT, © Resolve to Save Lives), library/healthicons/
//   插畫人物      DiceBear Open Peeps / Notionists / Lorelei (artwork CC0, code MIT)
//   背景與裝飾    LabSite's own generated patterns (below)
// Picked items become SVG files in the site (assets/library/…), coloured as chosen.

export const LIBRARY_DIR = "assets/library";
export const COLOR_PRESETS = ["#0d6557", "#2563a8", "#b4441c", "#8e2a5e", "#c47f1c", "#4b5563", "#e05a8a", "#1f2937"];
const hex = (c) => String(c || "#0d6557").replace(/^#/, "").toLowerCase().slice(0, 6);
export const validColor = (c) => /^#[0-9a-f]{6}$/i.test(String(c || ""));

/* -------------------------------------------------------------- icons */
export const ICONS_URL = "./library/healthicons.json";
export function colorIcon(svg, color) {
  return (
    String(svg)
      .replace(/currentColor/g, color)
      .replace(/<svg\b/, "<!-- Health Icons (https://healthicons.org), MIT License, © Resolve to Save Lives -->\n<svg") + "\n"
  );
}
export const iconAssetPath = (id, style, color) => `${LIBRARY_DIR}/icons/${id}-${style}-${hex(color)}.svg`;
export function searchIcons(icons, query = "", group = "") {
  const q = String(query).trim().toLowerCase();
  return icons.filter((i) => (!group || i.group === group) && (!q || i.name.includes(q) || i.en.toLowerCase().includes(q) || i.id.includes(q)));
}

/* ------------------------------------------------------------- people */
export const PEOPLE_STYLES = [
  { id: "open-peeps", name: "手繪人物", credit: "Open Peeps by Pablo Stanley (CC0)" },
  { id: "notionists", name: "線條人物", credit: "Notionists by Zoish (CC0)" },
  { id: "lorelei", name: "可愛頭像", credit: "Lorelei by Lisa Wischofsky (CC0)" },
];
// The styles are a separate file (library/people.js, built from
// tools/people-entry.js), downloaded the first time 插畫人物 opens.
export const PEOPLE_URL = "./library/people.js";
const STYLE_KEYS = { "open-peeps": "openPeeps", notionists: "notionists", lorelei: "lorelei" };
let peopleModule = null;
export async function personSvg(style, seed, background = "", load = () => import(/* @vite-ignore */ new URL(PEOPLE_URL, location.href).href)) {
  peopleModule ||= load();
  const lib = await peopleModule;
  return lib.createAvatar(lib[STYLE_KEYS[style]], { seed: String(seed), ...(background ? { backgroundColor: [hex(background)] } : {}) }).toString() + "\n";
}
const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 24) || "x";
export const personAssetPath = (style, seed, background = "") => `${LIBRARY_DIR}/people/${style}-${slug(seed)}${background ? "-" + hex(background) : ""}.svg`;
export const randomSeeds = (n, salt = Date.now()) => Array.from({ length: n }, (_, i) => (salt + i * 7919).toString(36));

/* ------------------------------------------------- backgrounds & décor */
// Mixes a colour with white: amount 0 = the colour, 1 = white.
export function tint(color, amount) {
  const c = hex(color);
  const v = [0, 2, 4].map((i) => parseInt(c.slice(i, i + 2), 16));
  return "#" + v.map((x) => Math.round(x + (255 - x) * amount).toString(16).padStart(2, "0")).join("");
}
// A tiny deterministic random, so the same pattern looks the same every time.
function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}
const wrap = (w, h, body, bg) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">${bg ? `<rect width="${w}" height="${h}" fill="${bg}"/>` : ""}${body}</svg>\n`;
const tile = (id, size, inner, w, h, bg) => wrap(w, h, `<defs><pattern id="${id}" width="${size}" height="${size}" patternUnits="userSpaceOnUse">${inner}</pattern></defs><rect width="${w}" height="${h}" fill="url(#${id})"/>`, bg);

export const DECOR = [
  { id: "dots", name: "點點", kind: "背景", svg: (c) => tile("p", 32, `<circle cx="16" cy="16" r="3" fill="${tint(c, 0.55)}"/>`, 1200, 800, tint(c, 0.94)) },
  { id: "grid", name: "方格", kind: "背景", svg: (c) => tile("p", 40, `<path d="M40 0H0V40" fill="none" stroke="${tint(c, 0.7)}" stroke-width="1.5"/>`, 1200, 800, tint(c, 0.95)) },
  { id: "crosses", name: "十字（醫療）", kind: "背景", svg: (c) => tile("p", 56, `<path d="M25 18h6v7h7v6h-7v7h-6v-7h-7v-6h7z" fill="${tint(c, 0.6)}"/>`, 1200, 800, tint(c, 0.94)) },
  { id: "diagonal", name: "斜線", kind: "背景", svg: (c) => tile("p", 24, `<path d="M-6 6l12-12M0 24L24 0M18 30l12-12" stroke="${tint(c, 0.7)}" stroke-width="3"/>`, 1200, 800, tint(c, 0.95)) },
  {
    id: "waves",
    name: "波浪",
    kind: "背景",
    svg: (c) => {
      const layers = [0.82, 0.68, 0.52].map((t, i) => {
        const y = 430 + i * 110;
        return `<path d="M0 ${y} C 200 ${y - 70}, 400 ${y + 70}, 600 ${y} S 1000 ${y - 70}, 1200 ${y} V800 H0Z" fill="${tint(c, t)}"/>`;
      });
      return wrap(1200, 800, layers.join(""), tint(c, 0.95));
    },
  },
  {
    id: "blobs",
    name: "柔和色塊",
    kind: "背景",
    svg: (c) => {
      const r = rng(7);
      const blobs = Array.from({ length: 5 }, (_, i) => `<circle cx="${Math.round(r() * 1200)}" cy="${Math.round(r() * 800)}" r="${Math.round(140 + r() * 180)}" fill="${tint(c, 0.6 + i * 0.07)}" opacity="0.7"/>`);
      return wrap(1200, 800, `<defs><filter id="b"><feGaussianBlur stdDeviation="60"/></filter></defs><g filter="url(#b)">${blobs.join("")}</g>`, tint(c, 0.95));
    },
  },
  {
    id: "rings",
    name: "同心圓",
    kind: "背景",
    svg: (c) => wrap(1200, 800, Array.from({ length: 9 }, (_, i) => `<circle cx="960" cy="200" r="${60 + i * 70}" fill="none" stroke="${tint(c, 0.55 + i * 0.04)}" stroke-width="2"/>`).join(""), tint(c, 0.96)),
  },
  {
    id: "confetti",
    name: "彩紙",
    kind: "背景",
    svg: (c) => {
      const r = rng(11);
      const bits = Array.from({ length: 70 }, () => {
        const x = Math.round(r() * 1200), y = Math.round(r() * 800), t = r();
        const fill = tint(c, 0.2 + r() * 0.5);
        return t < 0.4 ? `<circle cx="${x}" cy="${y}" r="${Math.round(4 + r() * 6)}" fill="${fill}"/>` : `<rect x="${x}" y="${y}" width="${Math.round(8 + r() * 10)}" height="5" rx="2" fill="${fill}" transform="rotate(${Math.round(r() * 180)} ${x} ${y})"/>`;
      });
      return wrap(1200, 800, bits.join(""), tint(c, 0.96));
    },
  },
  {
    id: "contours",
    name: "等高線",
    kind: "背景",
    svg: (c) =>
      wrap(
        1200,
        800,
        Array.from({ length: 12 }, (_, i) => {
          const y = 40 + i * 64;
          return `<path d="M-20 ${y} C 240 ${y - 50}, 420 ${y + 60}, 640 ${y + 10} S 1040 ${y - 60}, 1220 ${y + 20}" fill="none" stroke="${tint(c, 0.62)}" stroke-width="2"/>`;
        }).join(""),
        tint(c, 0.96),
      ),
  },
  { id: "ecg-line", name: "心電圖分隔線", kind: "裝飾", svg: (c) => wrap(1200, 120, `<path d="M0 60H430l25-40 30 85 28-110 26 120 22-55h639" fill="none" stroke="${c}" stroke-width="5" stroke-linejoin="round" stroke-linecap="round"/>`) },
  { id: "wave-line", name: "波浪分隔線", kind: "裝飾", svg: (c) => wrap(1200, 120, `<path d="M0 60 C 100 20, 200 100, 300 60 S 500 20, 600 60 S 800 100, 900 60 S 1100 20, 1200 60" fill="none" stroke="${c}" stroke-width="5" stroke-linecap="round"/>`) },
  { id: "dots-line", name: "圓點分隔線", kind: "裝飾", svg: (c) => wrap(1200, 60, Array.from({ length: 24 }, (_, i) => `<circle cx="${25 + i * 50}" cy="30" r="${i % 3 === 1 ? 8 : 5}" fill="${i % 3 === 1 ? c : tint(c, 0.5)}"/>`).join("")) },
  { id: "heart-badge", name: "愛心徽章", kind: "裝飾", svg: (c) => wrap(240, 240, `<circle cx="120" cy="120" r="110" fill="${tint(c, 0.88)}"/><path d="M120 178c-30-25-58-48-58-78 0-20 15-35 34-35 11 0 20 6 24 15 4-9 13-15 24-15 19 0 34 15 34 35 0 30-28 53-58 78z" fill="${c}"/>`) },
  { id: "cross-badge", name: "醫療十字徽章", kind: "裝飾", svg: (c) => wrap(240, 240, `<circle cx="120" cy="120" r="110" fill="${tint(c, 0.88)}"/><path d="M100 60h40v40h40v40h-40v40h-40v-40H60v-40h40z" fill="${c}"/>`) },
];
export const decorById = (id) => DECOR.find((d) => d.id === id);
export const decorAssetPath = (id, color) => `${LIBRARY_DIR}/decor/${id}-${hex(color)}.svg`;

export const svgDataUrl = (svg) => "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);

/* ----------------------------------------------------------- external */
export const EXTERNAL_SOURCES = [
  {
    id: "girlysozai",
    name: "ガーリー素材（girlysozai）",
    url: "https://girlysozai.com/",
    note: "柔和可愛的手繪插畫（花、人物、背景）。可以免費用在網站上、不用標示來源；但不能把素材再散布，所以 LabSite 不內建，請到網站下載 PNG，再用「選擇照片」上傳。",
  },
];
