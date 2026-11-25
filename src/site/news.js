// The latest news of a site whose js/data.js lists it itself:
//
//   const FALLBACK_NEWS = [
//     { date: "2026-08-11", category: "公告", content: "…", content_en: "…", link: "" },
//   ];
//
// The home page renders this list with the site's own script. Sites that read
// their news from a Google Sheet (CONFIG.SHEET_ID) only fall back to this list;
// moving the news into the editor copies the sheet here once and clears
// SHEET_ID, so the list becomes the news. Like album.js the file is never
// evaluated, and everything outside the array stays byte for byte.

const START = /const\s+FALLBACK_NEWS\s*=\s*\[/;
const KEYS = ["date", "category", "content", "content_en", "link"];
const OPTIONAL = new Set(["content_en", "link"]);
export const NEWS_CATEGORIES = ["公告", "榮譽", "發表", "活動"];

// Index of the "]" closing the "[" at `open`, skipping strings and comments.
export function closeOf(text, open) {
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

const stripComments = (s) =>
  s.replace(/("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')|\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, (m, str) => str || "");
const unquote = (s) => s.replace(/\\(.)/g, (_, c) => ({ n: "\n", t: "\t" })[c] ?? c);
const quote = (s) => '"' + String(s).replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\r?\n/g, " ") + '"';

// "2026/8/7", "2026-08-07T…" → "2026-08-07"; anything else is kept as typed.
export function normalizeDate(value) {
  const s = String(value ?? "").trim();
  const m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  return m ? `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}` : s;
}

// Newest first; items without a date go last, keeping their order.
export const sortNews = (items) =>
  items
    .map((n, i) => ({ n, i }))
    .sort((a, b) => (b.n.date || "").localeCompare(a.n.date || "") || a.i - b.i)
    .map((x) => x.n);

// The Google Sheet the site reads its news from: CONFIG.SHEET_ID (not EVENTS_SHEET_ID).
const SHEET = /(^|[^\w$])(SHEET_ID\s*:\s*)"([^"\\\n]*)"/m;
export function readSheetId(text) {
  const m = SHEET.exec(String(text || ""));
  return m && m[3] ? m[3] : null;
}

// → { ok, items, sheetId, start, end, reason? }
// ok is false when the site has no FALLBACK_NEWS, or lists news in a way this
// editor would lose (computed values, other keys).
export function readNews(text) {
  text = String(text || "");
  const sheetId = readSheetId(text);
  const m = START.exec(text);
  if (!m) return { ok: false, items: [], sheetId, reason: "missing" };
  const open = m.index + m[0].length - 1;
  const close = closeOf(text, open);
  if (close < 0) return { ok: false, items: [], sheetId, reason: "unparsed" };
  const body = stripComments(text.slice(open + 1, close));
  const items = [];
  const rest = body.replace(/\{([^{}]*)\}/g, (_, inner) => {
    const item = {};
    const left = inner.replace(/([A-Za-z_$][\w$]*)\s*:\s*(?:"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)')/g, (_, k, d, s) => {
      item[k] = unquote(d ?? s);
      return "";
    });
    if (left.replace(/[\s,]/g, "") || Object.keys(item).some((k) => !KEYS.includes(k))) item.invalid = true;
    items.push(item);
    return "";
  });
  if (rest.replace(/[\s,]/g, "") || items.some((n) => n.invalid)) return { ok: false, items: [], sheetId, reason: "unparsed" };
  return {
    ok: true,
    items: items.map((n) => Object.fromEntries(KEYS.map((k) => [k, n[k] || ""]))),
    sheetId,
    start: open,
    end: close + 1,
  };
}

// Replaces the array with `items`, newest first, one object per line.
export function writeNews(text, items) {
  const news = readNews(text);
  if (!news.ok) throw new Error("這個網站的 js/data.js 沒有可編輯的 FALLBACK_NEWS 最新消息清單。");
  const nl = text.includes("\r\n") ? "\r\n" : "\n";
  const line = (n) =>
    "  { " + KEYS.filter((k) => !OPTIONAL.has(k) || n[k] || k === "link").map((k) => k + ": " + quote(n[k] || "")).join(", ") + " }";
  const kept = sortNews(items.map((n) => ({ ...n, date: normalizeDate(n.date) })));
  const array = kept.length ? "[" + nl + kept.map(line).join("," + nl) + nl + "]" : "[]";
  return text.slice(0, news.start) + array + text.slice(news.end);
}

// Stops reading the Google Sheet: SHEET_ID becomes "" and the old id stays in
// a comment next to it, so the change can be undone by hand.
export function detachSheet(text) {
  const m = SHEET.exec(text);
  if (!m || !m[3]) return text;
  const at = m.index + m[1].length;
  const replaced = `${m[2]}"" /* 最新消息改在 LabSite 編輯器管理；原試算表 ${m[3]} */`;
  return text.slice(0, at) + replaced + text.slice(at + m[0].length - m[1].length);
}

/* --------------------------------------------------------- Google Sheet */
// The same endpoint the sites use (gviz JSON, public sheet, CORS allowed).
export const sheetUrl = (id, selector = "") =>
  `https://docs.google.com/spreadsheets/d/${encodeURIComponent(id)}/gviz/tq?tqx=out:json&headers=1${selector ? "&" + selector : ""}`;

function cellText(cell) {
  if (!cell || cell.v == null) return "";
  const d = typeof cell.v === "string" && cell.v.match(/^Date\((\d+),(\d+),(\d+)/);
  if (d) return `${d[1]}-${String(+d[2] + 1).padStart(2, "0")}-${d[3].padStart(2, "0")}`;
  return String(cell.v);
}

// gviz response text → news items (columns found by their header names).
export function parseSheetNews(responseText) {
  const s = String(responseText || "");
  const from = s.indexOf("(");
  const to = s.lastIndexOf(")");
  if (from < 0 || to < from) throw new Error("試算表回應的格式看不懂。");
  const table = JSON.parse(s.slice(from + 1, to)).table || {};
  const col = {};
  (table.cols || []).forEach((c, i) => {
    const key = String(c.label || "").trim().toLowerCase();
    if (KEYS.includes(key) && !(key in col)) col[key] = i;
  });
  if (!("content" in col)) throw new Error("試算表沒有 content 欄。");
  return (table.rows || [])
    .map((r) => Object.fromEntries(KEYS.map((k) => [k, k in col ? cellText(r.c?.[col[k]]).trim() : ""])))
    .map((n) => ({ ...n, date: normalizeDate(n.date), category: n.category || "公告" }))
    .filter((n) => n.content);
}

// Reads the sheet like the sites do: the "news" tab first, else the first tab.
export async function fetchSheetNews(id, fetchImpl = (...a) => fetch(...a)) {
  let lastError = null;
  for (const selector of ["sheet=news", ""]) {
    try {
      const res = await fetchImpl(sheetUrl(id, selector), { cache: "no-store" });
      if (!res.ok) throw new Error("讀不到試算表（" + res.status + "）。");
      const items = parseSheetNews(await res.text());
      if (items.length) return sortNews(items);
    } catch (e) {
      lastError = e;
    }
  }
  throw lastError || new Error("試算表裡沒有消息。");
}
