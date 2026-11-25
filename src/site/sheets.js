// Moving a site off Google Sheets, once and for good.
//
// Older lab sites read their latest news (CONFIG.SHEET_ID) and, on some, a
// list of key events (CONFIG.EVENTS_SHEET_ID) from public Google Sheets at
// page load. LabSite keeps both lists in js/data.js instead, where the editor
// can change them: this copies what each sheet holds now into the file's own
// arrays (FALLBACK_NEWS, FALLBACK_EVENTS) and clears the sheet ids, which the
// sites' scripts already treat as "use the list in this file". The sheets
// themselves are only read, never changed; the old ids stay in a comment.
import { readNews, writeNews, detachSheet, fetchSheetNews, readSheetId, closeOf, normalizeDate } from "./news.js";

const EVENTS_ID = /(^|[^\w$])(EVENTS_SHEET_ID\s*:\s*)"([^"\\\n]*)"/m;
const EVENTS_START = /const\s+FALLBACK_EVENTS\s*=\s*\[/;
const quote = (s) => '"' + String(s).replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\r?\n/g, " ") + '"';

export const readEventsSheetId = (text) => {
  const m = EVENTS_ID.exec(String(text || ""));
  return m && m[3] ? m[3] : null;
};

// Does this js/data.js still read anything from a Google Sheet?
export const usesSheets = (text) => !!(readSheetId(text) || readEventsSheetId(text));

function detachEvents(text) {
  const m = EVENTS_ID.exec(text);
  if (!m || !m[3]) return text;
  const at = m.index + m[1].length;
  return text.slice(0, at) + `${m[2]}"" /* 重要活動改寫在下方的 FALLBACK_EVENTS；原試算表 ${m[3]} */` + text.slice(at + m[0].length - m[1].length);
}

// gviz response → [{ date, title, description, image, pinned }]
export function parseSheetEvents(responseText) {
  const s = String(responseText || "");
  const table = JSON.parse(s.slice(s.indexOf("(") + 1, s.lastIndexOf(")"))).table || {};
  const col = {};
  (table.cols || []).forEach((c, i) => {
    const key = String(c.label || "").trim().toLowerCase();
    if (!(key in col)) col[key] = i;
  });
  if (!("title" in col)) throw new Error("重要活動試算表沒有 title 欄。");
  const cell = (r, k) => {
    const c = k in col ? r.c?.[col[k]] : null;
    if (!c || c.v == null) return "";
    const d = typeof c.v === "string" && c.v.match(/^Date\((\d+),(\d+),(\d+)/);
    if (d) return `${d[1]}-${String(+d[2] + 1).padStart(2, "0")}-${d[3].padStart(2, "0")}`;
    return String(c.f ?? c.v).trim();
  };
  return (table.rows || [])
    .map((r) => ({
      date: normalizeDate(cell(r, "date")),
      title: cell(r, "title"),
      description: cell(r, "description"),
      image: cell(r, "image"),
      pinned: /^(true|1|yes|y|是|v)$/i.test(cell(r, "pinned")),
    }))
    .filter((e) => e.title)
    .sort((a, b) => (b.date || "").localeCompare(a.date || ""));
}

// Replaces the FALLBACK_EVENTS array, one event per line.
export function writeEvents(text, items) {
  const m = EVENTS_START.exec(text);
  if (!m) throw new Error("js/data.js 沒有 FALLBACK_EVENTS。");
  const open = m.index + m[0].length - 1;
  const close = closeOf(text, open);
  if (close < 0) throw new Error("看不懂 js/data.js 的 FALLBACK_EVENTS。");
  const nl = text.includes("\r\n") ? "\r\n" : "\n";
  const line = (e) =>
    `  { date: ${quote(e.date)}, title: ${quote(e.title)}, description: ${quote(e.description)}, image: ${quote(e.image)}, pinned: ${e.pinned ? "true" : "false"} }`;
  const array = items.length ? "[" + nl + items.map(line).join("," + nl) + nl + "]" : "[]";
  return text.slice(0, open) + array + text.slice(close + 1);
}

async function fetchEvents(id, fetchImpl) {
  const url = `https://docs.google.com/spreadsheets/d/${encodeURIComponent(id)}/gviz/tq?tqx=out:json&headers=1&gid=0`;
  const res = await fetchImpl(url, { cache: "no-store" });
  if (!res.ok) throw new Error("讀不到重要活動試算表（" + res.status + "）。");
  return parseSheetEvents(await res.text());
}

// → { text, news, events } with the sheets copied in and switched off, or
// null when the file reads no sheet. A sheet that cannot be read is left
// switched on (nothing is lost); its error is in `errors`.
export async function moveOffSheets(text, fetchImpl = (...a) => fetch(...a)) {
  let out = String(text || "");
  const done = { news: null, events: null, errors: [] };
  const newsId = readSheetId(out);
  if (newsId) {
    try {
      if (!readNews(out).ok) throw new Error("js/data.js 沒有可編輯的 FALLBACK_NEWS。");
      const items = await fetchSheetNews(newsId, fetchImpl);
      out = detachSheet(writeNews(out, items));
      done.news = items.length;
    } catch (e) {
      done.errors.push("最新消息：" + e.message);
    }
  }
  const eventsId = readEventsSheetId(out);
  if (eventsId) {
    try {
      const items = await fetchEvents(eventsId, fetchImpl);
      // An empty sheet keeps the events the file already lists.
      out = detachEvents(items.length ? writeEvents(out, items) : out);
      done.events = items.length;
    } catch (e) {
      done.errors.push("重要活動：" + e.message);
    }
  }
  if (out === text) return done.errors.length ? { text: null, ...done } : null;
  return { text: out, ...done };
}
