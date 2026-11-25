// Moving a site's news (and key events) off Google Sheets into js/data.js.
import test from "node:test";
import assert from "node:assert/strict";
const { moveOffSheets, usesSheets, parseSheetEvents, writeEvents } = await import("../src/site/sheets.js");
const { readNews } = await import("../src/site/news.js");

const gviz = (cols, rows) =>
  "/*O_o*/\ngoogle.visualization.Query.setResponse(" +
  JSON.stringify({ table: { cols: cols.map((label) => ({ label })), rows: rows.map((r) => ({ c: r.map((v) => (v === null ? null : { v })) })) } }) +
  ");";
const NEWS = gviz(
  ["date", "category", "content", "content_en", "link"],
  [
    ["Date(2026,7,11)", "公告", "研究生李同學論文口試", "Thesis defense", null],
    ["Date(2025,0,5)", null, "新學期開始", null, "https://example.edu"],
    [null, null, null, null, null],
  ],
);
const EVENTS = gviz(["date", "title", "description", "image", "pinned"], [["Date(2026,0,1)", "計畫啟動", "與資策會合作、建立指標。", null, "TRUE"], ["2026-07-01", "延續計畫", "說明", null, "no"]]);

const DATA = `const SITE = {
  nameZh: "示範研究室",
};
const CONFIG = {
  SHEET_ID: "newsSheet123",        // 最新消息試算表
  EVENTS_SHEET_ID: "eventsSheet456", // 重要活動試算表
  DRIVE_FOLDER_ID: "",
};
const FALLBACK_NEWS = [
  { date: "2020-01-01", category: "公告", content: "舊的備用消息", link: "" }
];

const FALLBACK_EVENTS = [
  {
    date: "2020-01-01",
    title: "舊活動",
    description: "說明",
    image: "",
    pinned: true
  }
];
function fetchNews() { return CONFIG.SHEET_ID ? "sheet" : FALLBACK_NEWS; }
`;
const sheets = (over = {}) => {
  const calls = [];
  const fn = async (url) => {
    calls.push(url);
    const id = url.match(/\/d\/([^/]+)\//)[1];
    const body = over[id] ?? { newsSheet123: NEWS, eventsSheet456: EVENTS }[id];
    if (body instanceof Error) throw body;
    if (typeof body === "number") return new Response("", { status: body });
    return new Response(body);
  };
  fn.calls = calls;
  return fn;
};

test("moves news and events into js/data.js and switches both sheets off", async () => {
  assert.equal(usesSheets(DATA), true);
  const r = await moveOffSheets(DATA, sheets());
  assert.deepEqual([r.news, r.events, r.errors], [2, 2, []]);
  assert.equal(usesSheets(r.text), false);
  const news = readNews(r.text);
  assert.equal(news.sheetId, null);
  assert.deepEqual(
    news.items.map((n) => [n.date, n.category, n.content, n.content_en, n.link]),
    [
      ["2026-08-11", "公告", "研究生李同學論文口試", "Thesis defense", ""],
      ["2025-01-05", "公告", "新學期開始", "", "https://example.edu"],
    ],
  );
  assert.match(r.text, /SHEET_ID: "" \/\* 最新消息改在 LabSite 編輯器管理；原試算表 newsSheet123 \*\/,\s+\/\/ 最新消息試算表/);
  assert.match(r.text, /EVENTS_SHEET_ID: "" \/\* 重要活動改寫在下方的 FALLBACK_EVENTS；原試算表 eventsSheet456 \*\//);
  assert.match(r.text, /\{ date: "2026-07-01", title: "延續計畫", description: "說明", image: "", pinned: false \},\n  \{ date: "2026-01-01", title: "計畫啟動", description: "與資策會合作、建立指標。", image: "", pinned: true \}/);
  assert.ok(!r.text.includes("舊活動") && !r.text.includes("舊的備用消息"));
  // Everything else is byte for byte the same, and the result still runs.
  assert.ok(r.text.startsWith('const SITE = {\n  nameZh: "示範研究室",\n};'));
  assert.ok(r.text.endsWith('function fetchNews() { return CONFIG.SHEET_ID ? "sheet" : FALLBACK_NEWS; }\n'));
  const run = new Function(r.text + "; return [fetchNews(), FALLBACK_EVENTS];");
  const [list, events] = run();
  assert.equal(list.length, 2);
  assert.equal(events[1].pinned, true);
  // Done once: nothing left to move.
  assert.equal(await moveOffSheets(r.text, sheets()), null);
});

test("a sheet that cannot be read stays switched on; the other one still moves", async () => {
  const r = await moveOffSheets(DATA, sheets({ eventsSheet456: 403 }));
  assert.equal(r.news, 2);
  assert.equal(r.events, null);
  assert.match(r.errors[0], /重要活動：讀不到重要活動試算表（403）/);
  assert.match(r.text, /EVENTS_SHEET_ID: "eventsSheet456"/);
  assert.match(r.text, /SHEET_ID: "" \/\*/);
  // Both unreadable: no new text at all.
  const none = await moveOffSheets(DATA, sheets({ newsSheet123: new Error("offline"), eventsSheet456: 500 }));
  assert.equal(none.text, null);
  assert.equal(none.errors.length, 2);
  // An empty events sheet keeps the events already in the file.
  const empty = await moveOffSheets(DATA, sheets({ eventsSheet456: gviz(["date", "title"], []) }));
  assert.equal(empty.events, 0);
  assert.match(empty.text, /title: "舊活動"/);
  assert.match(empty.text, /EVENTS_SHEET_ID: "" \/\*/);
});

test("a file without sheets, or with an empty id, is left alone", async () => {
  const plain = DATA.replace('"newsSheet123"', '""').replace('"eventsSheet456"', '""');
  assert.equal(usesSheets(plain), false);
  const fetch = sheets();
  assert.equal(await moveOffSheets(plain, fetch), null);
  assert.equal(fetch.calls.length, 0);
});

test("events sheet parsing and writing", () => {
  const items = parseSheetEvents(EVENTS);
  assert.deepEqual(items.map((e) => [e.date, e.pinned]), [["2026-07-01", false], ["2026-01-01", true]]);
  assert.throws(() => parseSheetEvents(gviz(["date"], [])), /沒有 title 欄/);
  assert.throws(() => writeEvents("const X = 1;", items), /沒有 FALLBACK_EVENTS/);
  assert.equal(writeEvents("const FALLBACK_EVENTS = [ /* ] */ ];\nok", []), "const FALLBACK_EVENTS = [];\nok");
  assert.match(writeEvents('const FALLBACK_EVENTS = [];', [{ date: "", title: 'a "q" \\ b', description: "", image: "", pinned: false }]), /title: "a \\"q\\" \\\\ b"/);
});
