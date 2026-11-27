// 一鍵修正: the problems the 設計規範 checks find that have one right answer,
// fixed by the editor itself (no AI): spacing between Chinese and Latin
// text and full-width punctuation [T-05], PDF links that do not say what
// they are [AP-14], and the crop that gives member photos one shape [S-05].
// Photos too big [AP-25] and missing alt text [AP-20] are done by the
// editor with prepareImage and the AI (AutoFix.jsx). Everything here is a
// pure function, so the dialog can show before → after before anything changes.
import { formatBytes } from "./images.js";
import { resolveLink } from "./publishCheck.js";

const CJK = "\\u3400-\\u4dbf\\u4e00-\\u9fff\\uf900-\\ufaff";
const CJK_RE = new RegExp(`[${CJK}]`);
const SKIP = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "TEMPLATE", "SVG", "CODE", "PRE", "KBD", "SAMP", "TEXTAREA"]);

// Chinese right before Latin letters or digits, and the other way round,
// get one space — except numbers in dates and times (2026年11月, 3月5日,
// 14時) and ordinals (第3), which are written closed in Taiwan.
const ZH_THEN_LATIN = new RegExp(`([${CJK}])([A-Za-z0-9])`, "g");
const LATIN_THEN_ZH = new RegExp(`([A-Za-z0-9])([${CJK}])`, "g");
const CLOSED_AFTER_DIGIT = /[年月日時分秒點號樓期屆級次章節週歲]/;

export function typesetZh(text) {
  let out = String(text);
  out = out.replace(ZH_THEN_LATIN, (all, zh, latin) => (/\d/.test(latin) && (zh === "第" || CLOSED_AFTER_DIGIT.test(zh)) ? all : `${zh} ${latin}`));
  out = out.replace(LATIN_THEN_ZH, (all, latin, zh) => (/\d/.test(latin) && CLOSED_AFTER_DIGIT.test(zh) ? all : `${latin} ${zh}`));
  // Half-width punctuation inside Chinese.
  out = out.replace(new RegExp(`([${CJK}])\\s*,\\s*(?=[${CJK}])`, "g"), "$1，");
  out = out.replace(new RegExp(`([${CJK}])\\s*;\\s*`, "g"), "$1；");
  out = out.replace(new RegExp(`([${CJK}])\\s*:(?!\\/\\/)\\s*`, "g"), "$1：");
  out = out.replace(new RegExp(`([${CJK}])\\?`, "g"), "$1？");
  out = out.replace(new RegExp(`([${CJK}])!`, "g"), "$1！");
  out = out.replace(new RegExp(`\\(([^()]*[${CJK}][^()]*)\\)`, "g"), "（$1）");
  // A space the rules above put next to full-width punctuation is not needed.
  out = out.replace(/ ([，。、；：？！（）「」『』])/g, "$1").replace(/([，。、；：？！（）「」『』]) /g, "$1");
  return out;
}

const inEnglish = (el) => {
  for (let e = el; e && e.nodeType === 1; e = e.parentElement) {
    const lang = e.getAttribute("lang");
    if (lang) return /^en/i.test(lang);
  }
  return false;
};

// Every text node of a Chinese page that typesetZh would change.
// → [{ node, before, after }]
export function typesetChanges(doc) {
  const out = [];
  const walk = (el) => {
    for (const child of [...el.childNodes]) {
      if (child.nodeType === 3) {
        const v = child.nodeValue;
        if (!CJK_RE.test(v)) continue;
        const next = typesetZh(v);
        if (next !== v) out.push({ node: child, before: v, after: next });
      } else if (child.nodeType === 1 && !SKIP.has(child.tagName.toUpperCase()) && !(child.getAttribute("lang") && /^en/i.test(child.getAttribute("lang")))) walk(child);
    }
  };
  if (doc.body && !inEnglish(doc.documentElement)) walk(doc.body);
  return out;
}

// For editPage: applies typesetChanges, reports whether anything changed.
export const applyTypeset = (doc) => {
  const changes = typesetChanges(doc);
  for (const c of changes) c.node.nodeValue = c.after;
  return changes.length > 0;
};

/* ------------------------------------------------------------ PDF links */
const SAYS_PDF = /pdf|\d\s*[km]b/i;
// <a> elements linking to a PDF without saying so. sizes: Map(path → bytes).
export function pdfLinks(doc, page, sizes = new Map()) {
  const out = [];
  for (const a of doc.querySelectorAll("body a[href]")) {
    const href = a.getAttribute("href") || "";
    if (!/\.pdf(?:[?#]|$)/i.test(href) || SAYS_PDF.test(a.textContent || "") || !String(a.textContent || "").trim()) continue;
    const path = /^(?:[a-z]+:|\/\/)/i.test(href) ? null : resolveLink(page, href);
    const size = path ? sizes.get(path) : undefined;
    const en = page.startsWith("en/") || inEnglish(a);
    const label = en ? ` (PDF${size ? ", " + formatBytes(size) : ""})` : `（PDF${size ? "，" + formatBytes(size) : ""}）`;
    out.push({ el: a, before: a.textContent.trim(), after: a.textContent.trim() + label, label });
  }
  return out;
}
// Appends the label to the link's last text node (keeps icons and markup).
export const applyPdfLabels = (page, sizes) => (doc) => {
  const links = pdfLinks(doc, page, sizes);
  for (const l of links) {
    const texts = [];
    const walk = (n) => n.childNodes.forEach((c) => (c.nodeType === 3 && c.nodeValue.trim() ? texts.push(c) : c.nodeType === 1 && walk(c)));
    walk(l.el);
    const last = texts.at(-1);
    if (last) last.nodeValue = last.nodeValue.replace(/\s*$/, "") + l.label + (last.nodeValue.match(/\s*$/)[0] || "");
  }
  return links.length > 0;
};

/* ------------------------------------------------------- member photos */
const SHAPES = [
  [1, "正方形 1:1"],
  [4 / 5, "直式 4:5"],
  [3 / 4, "直式 3:4"],
  [2 / 3, "直式 2:3"],
];
// The shape most of the photos already have (nearest of the usual ones).
export function targetShape(dims) {
  const votes = new Map();
  for (const d of dims) {
    if (!d?.w || !d?.h) continue;
    const r = d.w / d.h;
    const [shape] = SHAPES.reduce((best, s) => (Math.abs(Math.log(r / s[0])) < Math.abs(Math.log(r / best[0])) ? s : best));
    votes.set(shape, (votes.get(shape) || 0) + 1);
  }
  if (!votes.size) return { ratio: 1, name: SHAPES[0][1] };
  const ratio = [...votes].sort((a, b) => b[1] - a[1] || (a[0] === 1 ? -1 : 1))[0][0];
  return { ratio, name: SHAPES.find((s) => s[0] === ratio)[1] };
}
// Photos more than 3 % off the target shape.
export const offShape = (d, ratio) => !!(d?.w && d?.h) && Math.abs(Math.log(d.w / d.h / ratio)) > 0.03;
// The crop to `ratio`: centred across, and for a tall photo a quarter of the
// spare height above (heads are near the top of portraits).
export function cropBox(w, h, ratio) {
  if (w / h > ratio) {
    const cw = Math.round(h * ratio);
    return { x: Math.round((w - cw) / 2), y: 0, w: cw, h };
  }
  const ch = Math.round(w / ratio);
  return { x: 0, y: Math.round((h - ch) * 0.25), w, h: ch };
}

// <img> elements on a page that show `path` → for replacing it everywhere.
export const replaceImageSrc = (page, from, to) => (doc) => {
  let n = 0;
  for (const img of doc.querySelectorAll("img[src]")) {
    if (resolveLink(page, img.getAttribute("src")) === from) {
      img.setAttribute("src", "../".repeat((page.match(/\//g) || []).length) + to);
      n++;
    }
  }
  return n > 0;
};
// Sets the alt text of the images on a page that show `path` and have none.
export const setMissingAlt = (page, path, alt) => (doc) => {
  let n = 0;
  for (const img of doc.querySelectorAll("img[src]")) {
    if (img.getAttribute("alt") === null && resolveLink(page, img.getAttribute("src")) === path) {
      img.setAttribute("alt", alt);
      n++;
    }
  }
  return n > 0;
};
