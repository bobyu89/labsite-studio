// Latest news (FALLBACK_NEWS in js/data.js) and moving it off a Google Sheet.
import test from "node:test";
import assert from "node:assert/strict";
import { readNews, writeNews, detachSheet, readSheetId, parseSheetNews, fetchSheetNews, normalizeDate, sheetUrl } from "../src/site/news.js";

// The shape of both lab sites' js/data.js (CONFIG with two sheet ids, a
// comment with "//" in a URL, news with and without English).
const DATA = `const SITE = { nameZh: "研究室" };

const CONFIG = {
  SHEET_ID: "1vrl5wBd", // 雲端「網站後台-消息與活動」試算表 https://docs.google.com/x
  EVENTS_SHEET_ID: "1f8JzHwb", // 重要活動
  DRIVE_API_KEY: ""
};

const FALLBACK_NEWS = [
  { date: "2026-07-16", category: "榮譽", content: "獲國科會補助赴加拿大", content_en: "Awarded an NSTC \\"grant\\"", link: "" },
  // 舊消息
  { date: "2025-06-15", category: "發表", content: "計畫書刊登於 JMIR", link: "https://doi.org/10.2196/x" },
  { date: "2026-08-11", category: "公告", content: "論文計畫口試", content_en: "Proposal defense", link: "" }
];

const FALLBACK_PHOTOS = [];
`;
const before = (s, marker) => s.slice(0, s.indexOf(marker));
const after = (s, marker) => s.slice(s.indexOf(marker));

test("readNews: items, keys filled in, sheet id (not the events sheet)", () => {
  const n = readNews(DATA);
  assert.equal(n.ok, true);
  assert.equal(n.sheetId, "1vrl5wBd");
  assert.equal(n.items.length, 3);
  assert.deepEqual(n.items[0], { date: "2026-07-16", category: "榮譽", content: "獲國科會補助赴加拿大", content_en: 'Awarded an NSTC "grant"', link: "" });
  assert.equal(n.items[1].content_en, "");
  assert.equal(n.items[1].link, "https://doi.org/10.2196/x");
});

test("writeNews: newest first, quotes escaped, everything outside the array byte for byte", () => {
  const added = [...readNews(DATA).items, { date: "2026/11/3", category: "活動", content: '新的 "消息"\n第二行', content_en: "", link: "" }];
  const text = writeNews(DATA, added);
  assert.equal(before(text, "const FALLBACK_NEWS"), before(DATA, "const FALLBACK_NEWS"));
  assert.equal(after(text, "\n\nconst FALLBACK_PHOTOS"), after(DATA, "\n\nconst FALLBACK_PHOTOS"));
  const back = readNews(text);
  assert.equal(back.ok, true);
  assert.deepEqual(back.items.map((n) => n.date), ["2026-11-03", "2026-08-11", "2026-07-16", "2025-06-15"]);
  assert.equal(back.items[0].content, '新的 "消息" 第二行');
  assert.match(text, /\{ date: "2025-06-15", category: "發表", content: "計畫書刊登於 JMIR", link: "https:\/\/doi.org\/10.2196\/x" \}/);
  // Removing everything leaves an empty list the site can still read.
  assert.match(writeNews(DATA, []), /const FALLBACK_NEWS = \[\];/);
  assert.deepEqual(readNews(writeNews(DATA, [])).items, []);
});

test("writeNews keeps CRLF files CRLF", () => {
  const crlf = DATA.replace(/\n/g, "\r\n");
  const text = writeNews(crlf, readNews(crlf).items);
  assert.equal(text.replace(/\r\n/g, "").includes("\n"), false);
  assert.equal(readNews(text).items.length, 3);
});

test("detachSheet: SHEET_ID cleared, old id kept in a comment, events sheet untouched", () => {
  const text = detachSheet(DATA);
  assert.equal(readSheetId(text), null);
  assert.match(text, /  SHEET_ID: "" \/\* 最新消息改在 LabSite 編輯器管理；原試算表 1vrl5wBd \*\/, \/\/ 雲端/);
  assert.match(text, /EVENTS_SHEET_ID: "1f8JzHwb"/);
  assert.equal(detachSheet(text), text, "already detached");
  assert.deepEqual(readNews(text).items, readNews(DATA).items);
});

test("readNews refuses lists it would lose", () => {
  assert.equal(readNews("const SITE = {};").reason, "missing");
  assert.equal(readNews('const FALLBACK_NEWS = [{ date: "x", content: "a", extra: "b" }];').reason, "unparsed");
  assert.equal(readNews("const FALLBACK_NEWS = [makeNews()];").reason, "unparsed");
  assert.throws(() => writeNews("const SITE = {};", []), /FALLBACK_NEWS/);
});

test("normalizeDate", () => {
  assert.equal(normalizeDate("2026/8/7"), "2026-08-07");
  assert.equal(normalizeDate("2026-08-07T10:00:00Z"), "2026-08-07");
  assert.equal(normalizeDate(" 2026.12.1 "), "2026-12-01");
  assert.equal(normalizeDate("下週"), "下週");
});

// A gviz response like Google sends it: wrapped in setResponse(...), dates as Date(y,m0,d).
const gviz = (cols, rows) =>
  "/*O_o*/\ngoogle.visualization.Query.setResponse(" +
  JSON.stringify({ version: "0.6", status: "ok", table: { cols: cols.map((label) => ({ label })), rows: rows.map((r) => ({ c: r.map((v) => (v == null ? null : { v })) })) } }) +
  ");";

test("parseSheetNews: columns by header name, dates, empty rows dropped, default category", () => {
  const items = parseSheetNews(
    gviz(
      ["Date", "category", "content", "content_en", "link", "備註"],
      [
        ["Date(2026,7,11)", "公告", "論文計畫口試", "Proposal defense", null, "x"],
        ["2026/1/5", null, "沒有分類的消息", null, "https://a.tw", null],
        [null, null, null, null, null, "空白列"],
      ],
    ),
  );
  assert.deepEqual(items, [
    { date: "2026-08-11", category: "公告", content: "論文計畫口試", content_en: "Proposal defense", link: "" },
    { date: "2026-01-05", category: "公告", content: "沒有分類的消息", content_en: "", link: "https://a.tw" },
  ]);
  assert.throws(() => parseSheetNews(gviz(["a", "b"], [])), /content/);
});

test("fetchSheetNews: the news tab first, else the first tab; newest first", async () => {
  const calls = [];
  const fetchImpl = async (url) => {
    calls.push(url);
    if (url.includes("sheet=news")) return new Response(gviz(["x"], []), { status: 200 });
    return new Response(gviz(["date", "content"], [["2025-01-01", "舊"], ["2026-01-01", "新"]]), { status: 200 });
  };
  const items = await fetchSheetNews("abc", fetchImpl);
  assert.deepEqual(items.map((n) => n.content), ["新", "舊"]);
  assert.deepEqual(calls, [sheetUrl("abc", "sheet=news"), sheetUrl("abc")]);
  await assert.rejects(fetchSheetNews("abc", async () => new Response("", { status: 404 })), /404/);
});
