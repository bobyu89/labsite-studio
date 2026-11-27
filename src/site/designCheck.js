// The design standard's automatic checks (design.js ANTI_PATTERNS with
// detect: "auto" that the older checks did not already cover). Each looks
// only at what the files say — page HTML, the site's CSS, file sizes and
// image headers — so the same site always gives the same answer, with no AI.
// Thresholds are set so the LabSite templates themselves pass (tested).
import { EMPTY_WORDS } from "./design.js";
import { parseColor, contrast, readTheme, contrastIssues } from "./themes.js";

const short = (s, n = 28) => {
  const t = String(s).replace(/\s+/g, " ").trim();
  return t.length > n ? t.slice(0, n) + "…" : t;
};
const SKIP = new Set(["script", "style", "noscript", "template", "svg"]);

/* ------------------------------------------------------------ colours */
function hsl(rgb) {
  const [r, g, b] = rgb.map((v) => v / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? ((g - b) / d + (g < b ? 6 : 0)) * 60 : max === g ? ((b - r) / d + 2) * 60 : ((r - g) / d + 4) * 60;
  return { h, s, l };
}
const COLOR_TOKEN = /#[0-9a-f]{6}\b|#[0-9a-f]{3}\b|rgba?\(\s*\d+[\s,]+\d+[\s,]+\d+[^)]*\)/gi;
function toRgb(token) {
  const m = String(token).match(/rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)(?:[\s,/]+([\d.]+%?))?/i);
  if (m) {
    const alpha = m[4] === undefined ? 1 : m[4].endsWith("%") ? parseFloat(m[4]) / 100 : parseFloat(m[4]);
    return alpha < 0.35 ? null : [+m[1], +m[2], +m[3]];
  }
  return parseColor(token);
}
// A gradient whose colours swing across hues (purple→blue, rainbow, neon):
// two or more saturated stops more than 35° apart, with one in 230–320°.
export function loudGradient(value) {
  for (const g of String(value).matchAll(/(?:repeating-)?(?:linear|radial|conic)-gradient\(([^;{}]*)\)/gi)) {
    const stops = (g[1].match(COLOR_TOKEN) || []).map(toRgb).filter(Boolean).map(hsl).filter((c) => c.s > 0.35 && c.l > 0.2 && c.l < 0.85);
    if (stops.length < 2) continue;
    const hues = stops.map((c) => c.h);
    let span = 0;
    for (const a of hues) for (const b of hues) span = Math.max(span, Math.min(Math.abs(a - b), 360 - Math.abs(a - b)));
    if (span > 35 && hues.some((h) => h >= 230 && h <= 320)) return true;
  }
  return false;
}
const isGrayText = (rgb) => {
  const c = hsl(rgb);
  return c.s < 0.12 && c.l > 0.35 && c.l < 0.8;
};
const isColoured = (rgb) => {
  const c = hsl(rgb);
  return c.s > 0.3 && c.l > 0.2 && c.l < 0.8;
};
const styleProp = (style, prop) => {
  const m = String(style || "").match(new RegExp("(?:^|;)\\s*" + prop + "\\s*:\\s*([^;]+)", "i"));
  return m ? m[1].trim() : null;
};

/* ------------------------------------------------------------- motion */
// cubic-bezier with an overshoot (bounce/elastic), or a keyword that says so.
export function bouncyEasing(css) {
  if (/\b(?:bounce|elastic|wobble|rubber-?band|jello)\b/i.test(css)) return true;
  for (const m of String(css).matchAll(/cubic-bezier\(\s*([-\d.]+)\s*,\s*([-\d.]+)\s*,\s*([-\d.]+)\s*,\s*([-\d.]+)\s*\)/gi)) {
    const y1 = +m[2];
    const y2 = +m[4];
    if (y1 > 1.05 || y1 < -0.05 || y2 > 1.05 || y2 < -0.05) return true;
  }
  return false;
}
// Durations in transition/animation declarations, in ms (infinite loops and
// the templates' 2.5 s fail-safe excluded).
export function slowMotion(css, limit = 800) {
  const out = [];
  for (const m of String(css).matchAll(/(?:^|[;{\s])(transition|animation)(?:-duration)?\s*:\s*([^;{}]+)/gi)) {
    if (/infinite|failsafe/i.test(m[2])) continue;
    for (const part of m[2].split(",")) {
      const t = part.trim().match(/(?:^|\s)(\d*\.?\d+)(m?s)\b/);
      if (!t) continue;
      const ms = t[2] === "s" ? parseFloat(t[1]) * 1000 : parseFloat(t[1]);
      if (ms > limit) out.push(Math.round(ms));
    }
  }
  return out;
}
const SCROLL_REVEAL = /\bdata-(?:aos|sal|scroll-reveal)\b|\bclass="[^"]*\b(?:wow|aos-init|animate__animated|reveal-on-scroll)\b/i;

/* -------------------------------------------------------------- fonts */
const GENERIC = /^(serif|sans-serif|monospace|cursive|fantasy|system-ui|ui-[a-z-]+|inherit|initial|unset|-apple-system|blinkmacsystemfont)$/i;
// The first (intended) family of every font-family / --font* declaration.
export function primaryFonts(css) {
  const out = new Set();
  for (const m of String(css).matchAll(/(?:font-family|--font[a-z-]*)\s*:\s*([^;{}]+)/gi)) {
    if (/var\(/.test(m[1])) continue;
    const first = m[1].split(",")[0].trim().replace(/^["']|["']$/g, "");
    if (first && !GENERIC.test(first)) out.add(first.toLowerCase());
  }
  return out;
}

/* ------------------------------------------------------------- images */
// Width and height from the first bytes of a PNG, JPEG, GIF or WebP file.
export function imageSize(bytes) {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes || []);
  const u16 = (i) => (b[i] << 8) | b[i + 1];
  const le16 = (i) => b[i] | (b[i + 1] << 8);
  const le24 = (i) => b[i] | (b[i + 1] << 8) | (b[i + 2] << 16);
  if (b.length > 24 && b[0] === 0x89 && b[1] === 0x50) return { w: (u16(16) << 16) | u16(18), h: (u16(20) << 16) | u16(22) };
  if (b.length > 10 && b[0] === 0x47 && b[1] === 0x49) return { w: le16(6), h: le16(8) };
  if (b.length >= 30 && b[0] === 0x52 && b[8] === 0x57 && b[9] === 0x45) {
    const kind = String.fromCharCode(b[12], b[13], b[14], b[15]);
    if (kind === "VP8 ") return { w: le16(26) & 0x3fff, h: le16(28) & 0x3fff };
    if (kind === "VP8L") {
      const v = b[21] | (b[22] << 8) | (b[23] << 16) | (b[24] << 24);
      return { w: (v & 0x3fff) + 1, h: ((v >> 14) & 0x3fff) + 1 };
    }
    if (kind === "VP8X") return { w: le24(24) + 1, h: le24(27) + 1 };
  }
  if (b.length > 4 && b[0] === 0xff && b[1] === 0xd8) {
    let i = 2;
    while (i + 9 < b.length) {
      if (b[i] !== 0xff) {
        i++;
        continue;
      }
      const marker = b[i + 1];
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) return { w: u16(i + 7), h: u16(i + 5) };
      i += 2 + u16(i + 2);
    }
  }
  return null;
}

/* ---------------------------------------------------------- per page */
const EMOJI = /^\s*(?:\p{Extended_Pictographic}|\p{Regional_Indicator})/u;
const VAGUE = /^(點這裡|按這裡|這裡|點此|更多|看更多|詳見|click here|here|more|read more|link|連結)$/i;
const COUNTER = /訪客(?:人)?數|您是第\s*\d+\s*位|瀏覽人次|累積人次|最佳解析度|best viewed|網站建置中|under construction/i;
const CAROUSEL = /\b(?:carousel|swiper|slick-slider|owl-carousel|splide|flickity|glide)\b/i;
const CARD = (el) => (el.getAttribute("class") || "").split(/\s+/).some((c) => c === "card" || /-card$/.test(c) || c === "ls-card");

// → { "AP-xx": [examples] } for one page.
export function designPage(page, html) {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const found = {};
  const add = (id, example) => (found[id] = found[id] || []).push(example);
  const body = doc.body;
  if (!body) return { found, inlineFonts: new Set() };

  // AP-01 gradients and AP-06 grey on colour, from inline styles.
  for (const el of body.querySelectorAll("[style]")) {
    const style = el.getAttribute("style") || "";
    if (loudGradient(style)) add("AP-01", `<${el.tagName.toLowerCase()}> 的背景是跨色相的漸層`);
    const bg = styleProp(style, "background-color") || styleProp(style, "background");
    const fg = styleProp(style, "color");
    const bgRgb = bg && toRgb((bg.match(COLOR_TOKEN) || [])[0]);
    const fgRgb = fg && toRgb((fg.match(COLOR_TOKEN) || [])[0]);
    if (bgRgb && fgRgb && isColoured(bgRgb) && isGrayText(fgRgb)) add("AP-06", short(el.textContent) || "彩色區塊上的灰字");
    if (bgRgb && fgRgb && (contrast(fgRgb, bgRgb) ?? 21) < 4.5 && el.textContent.trim()) add("AP-19", `「${short(el.textContent, 16)}」對比 ${Math.round(contrast(fgRgb, bgRgb) * 10) / 10}:1`);
  }

  // AP-02 card rows on most sections, AP-03 cards in cards.
  const sections = [...body.querySelectorAll("section")].filter((s) => !s.parentElement?.closest("section"));
  let cardRows = 0;
  for (const s of sections) {
    const parents = new Set([...s.querySelectorAll("*")].filter(CARD).map((c) => c.parentElement));
    if ([...parents].some((p) => [...p.children].filter(CARD).length >= 3)) cardRows++;
  }
  if (sections.length >= 3 && cardRows >= 3 && cardRows / sections.length > 0.6) add("AP-02", `${sections.length} 個區塊裡有 ${cardRows} 個是一排卡片`);
  for (const c of body.querySelectorAll("*")) if (CARD(c) && [...c.querySelectorAll("*")].some(CARD)) add("AP-03", short(c.textContent) || "卡片裡的卡片");

  // AP-04 emoji at the start of headings, list items and buttons.
  for (const el of body.querySelectorAll("h1, h2, h3, h4, li, button, .btn"))
    if (EMOJI.test(el.textContent || "")) add("AP-04", short(el.textContent));

  // AP-05 most sections centred (inline style or a centring class).
  const centred = sections.filter((s) => /text-align\s*:\s*center/i.test(s.getAttribute("style") || "") || /\b(?:text-center|center|centered|align-center)\b/i.test(s.getAttribute("class") || "")).length;
  if (sections.length >= 4 && centred >= 3 && centred / sections.length > 0.5) add("AP-05", `${sections.length} 個區塊裡有 ${centred} 個置中`);

  // AP-07 scroll-reveal libraries (content hidden until scrolled to).
  if (SCROLL_REVEAL.test(html)) add("AP-07", "內容要捲到才出現（AOS、WOW 這類效果）");

  // AP-08 empty words, AP-12 counters and "under construction".
  const words = new Map();
  const walk = (node) => {
    for (const child of node.childNodes) {
      if (child.nodeType === 3) {
        for (const m of child.nodeValue.matchAll(EMPTY_WORDS)) words.set(m[0].toLowerCase(), (words.get(m[0].toLowerCase()) || 0) + 1);
        if (COUNTER.test(child.nodeValue)) add("AP-12", short(child.nodeValue));
      } else if (child.nodeType === 1 && !SKIP.has(child.tagName.toLowerCase())) walk(child);
    }
  };
  walk(body);
  const total = [...words.values()].reduce((a, b) => a + b, 0);
  if (total >= 2) add("AP-08", [...words.keys()].slice(0, 4).map((w) => "「" + w + "」").join("") + (total > 4 ? ` 等 ${total} 處` : ""));
  for (const img of body.querySelectorAll("img")) if (/counter|hit-?count|visitor/i.test(img.getAttribute("src") || "")) add("AP-12", "訪客計數器圖片");

  // AP-11 carousels and marquees.
  if (body.querySelector("marquee")) add("AP-11", "<marquee> 跑馬燈");
  if (body.querySelector(".ls-marquee")) add("AP-11", "「跑馬燈」區塊會一直移動");
  for (const el of body.querySelectorAll("[class], [data-ride], [data-bs-ride]"))
    if (CAROUSEL.test(el.getAttribute("class") || "") || /carousel/i.test(el.getAttribute("data-ride") || el.getAttribute("data-bs-ride") || "")) {
      add("AP-11", "自動輪播的圖片");
      break;
    }

  // AP-14 PDFs without format and size in the link text.
  for (const a of body.querySelectorAll("a[href]")) {
    const href = a.getAttribute("href") || "";
    if (/\.pdf(?:[?#]|$)/i.test(href) && !/pdf|\d\s*[km]b/i.test(a.textContent || "")) add("AP-14", `「${short(a.textContent, 18) || href.split("/").pop()}」沒寫是 PDF 和檔案大小`);
  }

  // AP-16 links that do not say where they go.
  for (const a of body.querySelectorAll("a[href]")) {
    const words = short(a.textContent);
    if (words && VAGUE.test(words)) add("AP-16", `「${words}」`);
  }

  // AP-21 headings out of order or several h1.
  const h1 = body.querySelectorAll("h1").length;
  if (h1 > 1) add("AP-21", `有 ${h1} 個主標題（h1）`);
  let last = 0;
  for (const h of body.querySelectorAll("h1, h2, h3, h4, h5, h6")) {
    const level = Number(h.tagName[1]);
    if (last && level > last + 1) {
      add("AP-21", `「${short(h.textContent)}」是 h${level}，前一個是 h${last}`);
      break;
    }
    last = level;
  }

  // AP-15 fonts and AP-24 font sizes set by hand in the page.
  const inlineFonts = new Set();
  const sizes = new Set();
  for (const el of body.querySelectorAll("[style], font")) {
    const style = el.getAttribute("style") || "";
    const ff = styleProp(style, "font-family") || el.getAttribute("face");
    if (ff) {
      const first = ff.split(",")[0].trim().replace(/^["']|["']$/g, "");
      if (first && !GENERIC.test(first) && !/var\(/.test(first)) inlineFonts.add(first.toLowerCase());
    }
    const fs = styleProp(style, "font-size") || (el.tagName === "FONT" && el.getAttribute("size"));
    if (fs && !/var\(|em$|%$/.test(fs)) sizes.add(fs.replace(/\s+/g, ""));
  }
  if (sizes.size >= 6) add("AP-24", `手動設定了 ${sizes.size} 種字級（${[...sizes].slice(0, 4).join("、")}…）`);
  return { found, inlineFonts };
}

/* ---------------------------------------------------- members (AP-29) */
const ROLE_GROUP = [
  ["碩士", /碩|master/i],
  ["博士", /博(?!士後)|ph\.?d|doctoral/i],
  ["博士後", /博士後|post-?doc/i],
  ["助理", /(?<!教授)助理(?!教授)|research assistant|\bRA\b/i],
];
// Roles of one kind written in more than one way ("碩一" next to "碩士班二年級").
export function roleSpellings(roles) {
  const out = [];
  for (const [name, re] of ROLE_GROUP) {
    // Notes in brackets (共同指導, co-advised) are not a different title.
    const bare = (r) => r.replace(/[（(][^）)]*[）)]/g, "").trim();
    const forms = new Set(roles.map(bare).filter((r) => re.test(r) && !(name === "博士" && /博士後|post-?doc/i.test(r))).map((r) => r.replace(/[一二三四五六七1-7]/g, "N").replace(/\s+/g, "")));
    if (forms.size > 1) out.push(`${name}寫成 ${forms.size} 種：${[...forms].slice(0, 3).map((f) => f.replace(/N/g, "一")).join("／")}`);
  }
  return out;
}
// Photos of one list whose shapes differ by more than 10 %.
export function ratioSpread(dims) {
  const r = dims.filter((d) => d && d.w && d.h).map((d) => d.w / d.h);
  if (r.length < 3) return null;
  const min = Math.min(...r);
  const max = Math.max(...r);
  return max / min > 1.1 ? { min, max } : null;
}

/* ------------------------------------------------------------- the site */
// pages: [{ path, html }]; styles: [{ path, text }]; files: [{ path, size }];
// members: { roles: [], dims: [{ w, h }] } | null.
// → { "AP-xx": [{ page, count, examples }] }
export function designSite({ pages = [], styles = [], files = [], members = null } = {}) {
  const out = {};
  const push = (id, page, examples) => {
    if (!examples.length) return;
    (out[id] = out[id] || []).push({ page, count: examples.length, examples: [...new Set(examples)].slice(0, 3) });
  };
  const fonts = new Set();
  for (const { path, html } of pages) {
    if (!html) continue;
    const r = designPage(path, html);
    for (const [id, list] of Object.entries(r.found || {})) push(id, path, list);
    for (const f of r.inlineFonts || []) fonts.add(f);
  }
  for (const { path, text } of styles) {
    if (!text) continue;
    const css = String(text).replace(/\/\*[\s\S]*?\*\//g, "");
    if (loudGradient(css)) push("AP-01", path, ["樣式裡有跨色相的漸層"]);
    if (bouncyEasing(css)) push("AP-07", path, ["有彈跳效果的動畫"]);
    const slow = slowMotion(css);
    if (slow.length) push("AP-07", path, [`動畫太慢（${Math.max(...slow)}ms）`]);
    for (const f of primaryFonts(css)) fonts.add(f);
    const theme = readTheme(css);
    if (theme && theme.vars["--ink"]) {
      for (const x of contrastIssues({ "--on-zone": "#ffffff", "--on-join": "#ffffff", ...theme.vars })) push("AP-19", path, [`${x.label} ${x.ratio}:1`]);
    }
  }
  // Monospace for numbers is the allowed third face (T-03).
  const faces = [...fonts].filter((f) => !/mono|code|courier/i.test(f) && !/^(noto (sans|serif) tc|pingfang tc|microsoft jhenghei|songti tc|pmingliu|kaiti tc|dfkai-sb|lxgw wenkai tc)$/i.test(f));
  if (faces.length > 3) push("AP-15", null, [`用了 ${faces.length} 種字體：${faces.slice(0, 5).join("、")}`]);
  const used = new Set(pages.flatMap(({ html }) => [...String(html || "").matchAll(/(?:src|href)="([^"]+\.(?:jpe?g|png|webp|gif))"/gi)].map((m) => m[1].split("/").pop())));
  const big = files.filter((f) => /\.(jpe?g|png|webp|gif)$/i.test(f.path) && f.size > 800 * 1024 && used.has(f.path.split("/").pop()));
  if (big.length) push("AP-25", null, big.map((f) => `${f.path.split("/").pop()}（${(f.size / 1048576).toFixed(1)} MB）`));
  if (members) {
    const spread = ratioSpread(members.dims || []);
    const spell = roleSpellings(members.roles || []);
    push("AP-29", members.page || null, [...(spread ? [`成員照片的長寬比從 ${spread.min.toFixed(2)} 到 ${spread.max.toFixed(2)}`] : []), ...spell]);
  }
  return out;
}
