// v4.23 看改了什麼: version differences in words a teacher can read.
import test from "node:test";
import assert from "node:assert/strict";
import "./dom.js";
const { diffLines, inlineDiff, pageLines, textLines, changes, fileKind } = await import("../src/site/diff.js");

test("line diff: common start and end kept, the middle lined up", () => {
  const ops = diffLines(["a", "b", "c", "d"], ["a", "x", "c", "d", "e"]);
  assert.deepEqual(
    ops.map((o) => o.op + ":" + (o.a ?? o.b)),
    ["same:a", "del:b", "add:x", "same:c", "same:d", "add:e"],
  );
  assert.deepEqual(diffLines([], ["n"]), [{ op: "add", b: "n" }]);
});

test("inline diff marks only the changed words", () => {
  const d = inlineDiff("2026 年 3 月研討會", "2026 年 4 月研討會");
  assert.deepEqual(d.before, [
    { text: "2026 年 ", changed: false },
    { text: "3", changed: true },
    { text: " 月研討會", changed: false },
  ]);
  assert.deepEqual(d.after.map((x) => x.text), ["2026 年 ", "4", " 月研討會"]);
});

const page = (body, title = "首頁") => `<!DOCTYPE html><html><head><title>${title}</title></head><body>${body}</body></html>`;

test("page changes, grouped by section: edits, additions, links and pictures", () => {
  const before = page(
    '<section class="section"><h2>關於我們</h2><p>我們研究高齡照護。</p><a class="btn" href="contact.html">聯絡</a></section><section class="section"><h2>成員</h2><p>王小明</p></section>',
  );
  const after = page(
    '<section class="section"><h2>關於我們</h2><p>我們研究高齡照護與智慧照護。</p><a class="btn" href="https://example.org">聯絡</a></section><section class="section"><h2>成員</h2><p>王小明</p><p>陳小華</p><img src="assets/team.jpg" alt="合照"></section>',
    "首頁｜知行",
  );
  const groups = changes(pageLines(before), pageLines(after));
  assert.deepEqual(
    groups.map((g) => [g.where, g.rows.map((r) => r.op + ":" + (r.after ?? r.before))]),
    [
      ["分享設定", ["change:頁面標題：首頁｜知行"]],
      ["關於我們", ["change:我們研究高齡照護與智慧照護。", "change:連結：https://example.org"]],
      ["成員", ["add:陳小華", "add:圖片：team.jpg（合照）"]],
    ],
  );
  // A new page: everything is new; a deleted one: everything removed.
  assert.ok(changes([], pageLines(after)).every((g) => g.rows.every((r) => r.op === "add")));
  assert.ok(changes(pageLines(before), []).every((g) => g.rows.every((r) => r.op === "del")));
});

test("text files line by line; file kinds", () => {
  const g = changes(textLines('const A = 1;\nconst NEWS = ["舊消息"];\n'), textLines('const A = 1;\nconst NEWS = ["新消息"];\n'));
  assert.deepEqual(g, [{ where: "", rows: [{ op: "change", before: 'const NEWS = ["舊消息"];', after: 'const NEWS = ["新消息"];' }] }]);
  assert.deepEqual(["index.html", "en/a.htm", "js/data.js", "css/main.css", "assets/a.jpg"].map(fileKind), ["page", "page", "text", "style", "file"]);
});
