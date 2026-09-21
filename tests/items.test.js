import test from "node:test";
import assert from "node:assert/strict";
import "./dom.js";
const { parsePage, sectionElements, describeNode, describeItem, addItem, removeItem, moveItem, editHtml, nodeAt } =
  await import("../src/site/page.js");

const PAGE = [
  "<!DOCTYPE html>",
  "<html><head><title>t</title></head>",
  "<body>",
  '  <section class="section" id="members">',
  "    <h2>研究團隊</h2>",
  '    <div class="member-grid">',
  '      <div class="card member-card reveal" data-reveal-group="m">',
  '        <h3 class="member-card__name">游明勳</h3>',
  "        <ul>",
  "          <li>基隆長庚醫院內科護理師</li>",
  "          <li>碩士二年級</li>",
  "        </ul>",
  '        <div class="chips"><span class="chip">內科</span><span class="chip">急重症</span></div>',
  "      </div>",
  '      <div class="card member-card reveal" data-reveal-group="m">',
  '        <h3 class="member-card__name">李妍鋅</h3>',
  "        <ul>",
  "          <li>碩士二年級</li>",
  "        </ul>",
  '        <div class="chips"><span class="chip">護理</span></div>',
  "      </div>",
  "    </div>",
  '    <div class="wip">更多成員陸續加入中</div>',
  "  </section>",
  '  <section class="section" id="pubs">',
  '    <ol class="pub-list reveal">',
  '      <li class="pub-item"><span class="pub-item__index">1.</span><p class="pub-item__text">First paper</p></li>',
  '      <li class="pub-item"><span class="pub-item__index">2.</span><p class="pub-item__text">Second paper</p></li>',
  '      <li class="pub-item"><span class="pub-item__index">3.</span><p class="pub-item__text">Third paper</p></li>',
  "    </ol>",
  "    <table><thead><tr><th>年度</th><th>獎項</th></tr></thead><tbody>",
  "      <tr><td>114年</td><td>甲獎</td></tr>",
  "      <tr><td>113年</td><td>乙獎</td></tr>",
  "    </tbody></table>",
  "  </section>",
  "</body></html>",
  "",
].join("\n");

const section = (html, i) => sectionElements(parsePage(html).doc)[i];

test("repeated siblings with the same tag and class are detected as lists, nested ones inside items", () => {
  const members = describeNode(section(PAGE, 0));
  assert.deepEqual(
    members.fields.map((f) => f.value),
    ["研究團隊", "更多成員陸續加入中"],
  );
  assert.equal(members.lists.length, 1);
  const grid = members.lists[0];
  assert.equal(grid.label, "成員");
  assert.deepEqual(grid.items.map((i) => i.title), ["游明勳", "李妍鋅"]);
  assert.equal(grid.numbered, false);
  const first = describeItem(section(PAGE, 0), grid.items[0].path);
  assert.deepEqual(first.fields.map((f) => f.value), ["游明勳"]);
  assert.deepEqual(
    first.lists.map((l) => [l.label, l.items.map((i) => i.title)]),
    [
      ["條列項目", ["基隆長庚醫院內科護理師", "碩士二年級"]],
      ["標籤", ["內科", "急重症"]],
    ],
  );
  // Single-child <ul> and "chips" containers still count as lists so items can be added.
  const second = describeItem(section(PAGE, 0), grid.items[1].path);
  assert.deepEqual(second.lists.map((l) => l.items.length), [1, 1]);
  const pubs = describeNode(section(PAGE, 1));
  assert.deepEqual(
    pubs.lists.map((l) => [l.label, l.numbered, l.items.length]),
    [
      ["文獻", true, 3],
      ["表格列", false, 2],
    ],
  );
  assert.equal(pubs.lists[0].items[1].title, "Second paper");
});

test("adding an item clones the neighbour with its indentation and renumbers", () => {
  const out = editHtml(PAGE, (doc) => {
    const s = sectionElements(doc)[1];
    const list = describeNode(s).lists[0];
    return addItem(s, list.path, 0);
  });
  const lines = out.split("\n");
  const pubLines = lines.filter((l) => l.includes('class="pub-item"'));
  assert.equal(pubLines.length, 4);
  assert.ok(pubLines.every((l) => l.startsWith("      <li")));
  const s = section(out, 1);
  const list = describeNode(s).lists[0];
  assert.deepEqual(list.items.map((i) => i.title), ["First paper", "First paper", "Second paper", "Third paper"]);
  assert.deepEqual(
    list.items.map((i) => nodeAt(s, i.path).querySelector(".pub-item__index").textContent),
    ["1.", "2.", "3.", "4."],
  );
});

test("removing and moving items keeps whitespace tidy, renumbers, and refuses to empty a list", () => {
  const removed = editHtml(PAGE, (doc) => {
    const s = sectionElements(doc)[1];
    return removeItem(s, describeNode(s).lists[0].path, 0);
  });
  const s1 = section(removed, 1);
  assert.deepEqual(describeNode(s1).lists[0].items.map((i) => i.title), ["Second paper", "Third paper"]);
  assert.deepEqual(
    [...nodeAt(s1, describeNode(s1).lists[0].path).children].map((li) => li.firstElementChild.textContent),
    ["1.", "2."],
  );
  assert.ok(!removed.includes("\n\n      <li"));
  const moved = editHtml(PAGE, (doc) => {
    const s = sectionElements(doc)[1];
    return moveItem(s, describeNode(s).lists[0].path, 2, 0);
  });
  const s2 = section(moved, 1);
  const items = describeNode(s2).lists[0].items;
  assert.deepEqual(items.map((i) => i.title), ["Third paper", "First paper", "Second paper"]);
  assert.deepEqual(items.map((i) => nodeAt(s2, i.path).firstElementChild.textContent), ["1.", "2.", "3."]);
  assert.equal(moved.split("\n").length, PAGE.split("\n").length);
  // Table rows move too, and the header row is untouched.
  const rows = editHtml(PAGE, (doc) => {
    const s = sectionElements(doc)[1];
    return moveItem(s, describeNode(s).lists[1].path, 1, 0);
  });
  assert.ok(rows.indexOf("113年") < rows.indexOf("114年"));
  assert.ok(rows.includes("<th>年度</th>"));
  // Last remaining item cannot be removed.
  const one = editHtml(PAGE, (doc) => {
    const s = sectionElements(doc)[0];
    const grid = describeNode(s).lists[0].path;
    assert.equal(removeItem(s, grid, 1), true);
    assert.equal(removeItem(s, grid, 0), false);
    return true;
  });
  assert.equal(describeNode(section(one, 0)).lists[0].items.length, 1);
});

test("new member cards drop duplicated ids and keep nested lists editable", () => {
  const withId = PAGE.replace('<div class="card member-card reveal" data-reveal-group="m">', '<div class="card member-card reveal" data-reveal-group="m" id="first">');
  const out = editHtml(withId, (doc) => {
    const s = sectionElements(doc)[0];
    return addItem(s, describeNode(s).lists[0].path);
  });
  assert.equal((out.match(/id="first"/g) || []).length, 1);
  const s = section(out, 0);
  const items = describeNode(s).lists[0].items;
  assert.equal(items.length, 3);
  assert.equal(describeItem(s, items[2].path).lists[0].items.length, 1);
});

test("zh/en pages pair up and structure signatures track structural edits", async () => {
  const { pairOf, structureSignature } = await import("../src/site/page.js");
  const pages = ["index.html", "members.html", "en/index.html", "en/members.html", "awards.html"];
  assert.equal(pairOf("members.html", pages), "en/members.html");
  assert.equal(pairOf("en/index.html", pages), "index.html");
  assert.equal(pairOf("awards.html", pages), null);
  const sig = (html) => structureSignature(parsePage(html).doc);
  const en = PAGE.replace("游明勳", "Ming-Hsun Yu").replace("研究團隊", "Team");
  assert.equal(sig(PAGE), sig(en));
  const added = editHtml(PAGE, (doc) => {
    const s = sectionElements(doc)[0];
    return addItem(s, describeNode(s).lists[0].path);
  });
  assert.notEqual(sig(added), sig(en));
  const enAdded = editHtml(en, (doc) => {
    const s = sectionElements(doc)[0];
    return addItem(s, describeNode(s).lists[0].path);
  });
  assert.equal(sig(added), sig(enAdded));
});
