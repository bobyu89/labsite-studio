import test from "node:test";
import assert from "node:assert/strict";
import { seed, clone, nextRecord, moveBlock, validate } from "../src/model.js";
import { legacySeed } from "../src/domain/seed.js";
import {
  normalizeDocument,
  parseProject,
  serializeProject,
  homepage,
  firstHero,
} from "../src/domain/project.js";
import { readSavedRecord } from "../src/domain/storage.js";
import { createHistory, historyReducer } from "../src/domain/history.js";
import { themeCSS } from "../src/domain/theme.js";

test("incomplete news date can be saved as a draft but blocks publishing checks", () => {
  const draft = clone(seed);
  draft.collections.news[0].date = "";
  assert.equal(nextRecord(null, 0, draft).draft.collections.news[0].date, "");
  assert.ok(validate(draft).some((message) => message.includes("消息日期")));
});

test("old backup migrates content, theme, stable IDs and collection references", () => {
  const before = clone(legacySeed);
  const d = parseProject(JSON.stringify({ schemaVersion: 1, draft: before }));
  assert.equal(d.schemaVersion, 2);
  assert.equal(firstHero(d).props.title, legacySeed.title);
  assert.deepEqual(d.collections.news, legacySeed.news);
  assert.equal(d.theme.color, legacySeed.color);
  assert.deepEqual(
    homepage(d).blocks.map((b) => b.id),
    legacySeed.blocks.map((b) => b.id),
  );
  assert.equal(homepage(d).blocks[1].collectionId, "research");
  assert.deepEqual(before, legacySeed);
});
test("old duplicated heroes gain independent content", () => {
  const old = clone(legacySeed);
  old.blocks.push({ ...old.blocks[0], id: "copy" });
  const d = normalizeDocument(old);
  d.pages[0].blocks.at(-1).props.title = "different";
  assert.equal(firstHero(d).props.title, old.title);
});
test("v2 JSON export and import round-trip without loss", () =>
  assert.deepEqual(parseProject(serializeProject(seed)), seed));
test("future versions and malformed JSON are rejected", () => {
  assert.throws(() => parseProject("{oops"), /JSON/);
  assert.throws(
    () => parseProject(JSON.stringify({ ...seed, schemaVersion: 3 })),
    /較新/,
  );
  assert.throws(
    () => parseProject(JSON.stringify({ schemaVersion: 3, draft: seed })),
    /版本/,
  );
});
test("duplicate block IDs and dangling collection references are rejected", () => {
  const d = clone(seed);
  d.pages[0].blocks.push(clone(d.pages[0].blocks[0]));
  assert.throws(() => normalizeDocument(d), /ID/);
  d.pages[0].blocks.pop();
  d.pages[0].blocks[1].collectionId = "other";
  assert.throws(() => normalizeDocument(d), /集合/);
});
test("invalid theme values and unsupported image URLs are rejected", () => {
  const d = clone(seed);
  d.theme.color = "red;display:none";
  assert.throws(() => normalizeDocument(d), /主題/);
  d.theme.color = "#0d6557";
  d.assets = [
    {
      id: "image",
      name: "test",
      alt: "test",
      src: "https://example.org/private.png",
    },
  ];
  assert.throws(() => normalizeDocument(d), /圖片/);
});
test("unknown fields are stripped while ordinary content is preserved", () => {
  const d = clone(seed);
  d.privateToken = "not allowed";
  d.pages[0].blocks[0].props.html = "<script>bad</script>";
  const n = normalizeDocument(d);
  assert.equal(n.privateToken, undefined);
  assert.equal(firstHero(n).props.html, undefined);
});
test("multiple pages are rejected explicitly instead of being silently discarded", () => {
  const d = clone(seed);
  d.pages.push({ ...clone(d.pages[0]), id: "about", path: "/about" });
  assert.throws(() => normalizeDocument(d), /多頁/);
});
test("reading old saved records migrates every snapshot without storage writes", () => {
  const raw = JSON.stringify({
    revision: 1,
    savedAt: "2026-09-18T00:00:00Z",
    draft: legacySeed,
    history: [
      { revision: 1, savedAt: "2026-09-18T00:00:00Z", draft: legacySeed },
    ],
  });
  const result = readSavedRecord({
    getItem: () => raw,
    setItem: () => assert.fail("unexpected write"),
  });
  assert.equal(result.error, null);
  assert.equal(result.migrated, true);
  assert.equal(result.record.revision, 1);
  assert.equal(result.record.history[0].draft.schemaVersion, 2);
});
test("invalid stored records report an error without replacing data", () => {
  assert.ok(readSavedRecord({ getItem: () => "{broken" }).error);
});
test("saved snapshots remain fixed when editing continues", () => {
  const d = clone(seed),
    saved = nextRecord(null, 0, d);
  firstHero(d).props.title = "new";
  assert.notEqual(firstHero(saved.draft).props.title, firstHero(d).props.title);
  assert.equal(saved.revision, 1);
});
test("stale writes cannot replace a newer revision", () =>
  assert.throws(
    () => nextRecord(nextRecord(null, 0, seed), 0, seed),
    /conflict/,
  ));
test("restoring creates a new revision and retains intervening history", () => {
  let a = nextRecord(null, 0, seed);
  const d = clone(seed);
  firstHero(d).props.title = "new";
  a = nextRecord(a, 1, d);
  a = nextRecord(a, 2, a.history[1].draft);
  assert.equal(a.revision, 3);
  assert.equal(firstHero(a.draft).props.title, firstHero(seed).props.title);
  assert.equal(firstHero(a.history[1].draft).props.title, "new");
});
test("reordering preserves block identity and collection contents", () => {
  const d = moveBlock(seed, "research", 1);
  assert.equal(homepage(d).blocks[2].id, "research");
  assert.deepEqual(d.collections, seed.collections);
});
test("missing content and alt text block readiness", () => {
  assert.deepEqual(validate(seed), []);
  const d = clone(seed);
  firstHero(d).props.title = "";
  d.assets = [{ alt: "" }];
  assert.equal(validate(d).length, 2);
});
test("continuous edits to a field undo as one operation, with redo", () => {
  let s = createHistory(seed);
  for (const [i, name] of ["知", "知行", "知行研究"].entries())
    s = historyReducer(s, {
      type: "change",
      update: { name },
      group: "name",
      at: 100 + i * 100,
    });
  assert.equal(s.past.length, 1);
  s = historyReducer(s, { type: "undo" });
  assert.equal(s.present.name, seed.name);
  s = historyReducer(s, { type: "redo" });
  assert.equal(s.present.name, "知行研究");
});
test("focus boundaries, pauses and structural actions break undo grouping", () => {
  let s = createHistory(seed);
  const edit = (name, at) => ({
    type: "change",
    update: { name },
    group: "name",
    at,
  });
  s = historyReducer(s, edit("one", 0));
  s = historyReducer(s, { type: "boundary" });
  s = historyReducer(s, edit("two", 100));
  s = historyReducer(s, edit("three", 1500));
  s = historyReducer(s, {
    type: "change",
    update: { email: "lab@example.org" },
    at: 1600,
  });
  assert.equal(s.past.length, 4);
});
test("import is a single undoable replacement and does not mutate earlier content", () => {
  const replacement = clone(seed);
  replacement.name = "Imported";
  let s = createHistory(seed);
  s = historyReducer(s, { type: "change", update: () => replacement, at: 1 });
  s = historyReducer(s, { type: "undo" });
  assert.deepEqual(s.present, seed);
});
test("new edit after undo drops the redo branch", () => {
  let s = createHistory(seed);
  s = historyReducer(s, { type: "change", update: { name: "one" }, at: 0 });
  s = historyReducer(s, { type: "undo" });
  s = historyReducer(s, { type: "change", update: { name: "two" }, at: 100 });
  assert.equal(s.future.length, 0);
});
test("site theme maps to bounded CSS tokens shared by preview and export", () => {
  const css = themeCSS({
    ...seed.theme,
    radius: "round",
    spacing: "airy",
    textSize: "large",
  });
  assert.match(css, /--site-radius:22px/);
  assert.match(css, /--site-space:76px/);
  assert.match(css, /--site-body:19px/);
});
