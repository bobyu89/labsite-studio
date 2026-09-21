// End-to-end: the GitHub source against a real repository.
//
// Skipped unless both are set:
//   LABSITE_E2E_TOKEN  a fine-grained token with Contents: read/write on the repo
//   LABSITE_E2E_REPO   owner/name of a throwaway repository (never a real site)
// Optional: LABSITE_E2E_BRANCH (default: the repo's default branch).
//
// Run with `npm run test:e2e`. The test owns one file, labsite-e2e.html, which
// it creates on first run and always restores to its original content; every
// step is one real commit, so expect ~4 commits per run.
import test from "node:test";
import assert from "node:assert/strict";
import "./dom.js";
import { githubSource, defaultBranch, githubUser, parseRepo } from "../src/site/github.js";
const { editHtml, parsePage, listSections, sectionElements, collectFields, setText } = await import("../src/site/page.js");

const TOKEN = process.env.LABSITE_E2E_TOKEN || "";
const REPO = process.env.LABSITE_E2E_REPO || "";
const skip = !(TOKEN && REPO) && "set LABSITE_E2E_TOKEN and LABSITE_E2E_REPO to run";
const PAGE = "labsite-e2e.html";
const FIXTURE = [
  "<!DOCTYPE html>",
  '<html lang="zh-Hant">',
  "<head>",
  '  <meta charset="UTF-8">',
  "  <title>LabSite E2E 夾具</title>",
  "</head>",
  "<body>",
  '  <section class="section" id="hello">',
  "    <h2>你好</h2>",
  "    <p>這一頁由 tests/e2e-github.test.js 建立與還原，請勿手動修改。</p>",
  "  </section>",
  "</body>",
  "</html>",
  "",
].join("\n");

test("GitHub source: read, edit, commit, detect a stale write, restore", { skip, timeout: 120_000 }, async () => {
  const { owner, repo } = parseRepo(REPO);
  const branch = process.env.LABSITE_E2E_BRANCH || (await defaultBranch(owner, repo, TOKEN));
  const me = await githubUser(TOKEN);
  assert.ok(me.login, "token identifies a user");

  const open = () => githubSource({ owner, repo, branch, token: TOKEN });
  const a = open();
  assert.equal(a.writable, true);

  // 1. Make sure the fixture page exists (first run creates it: one commit).
  let original;
  const pages = await a.listPages();
  if (pages.includes(PAGE)) original = await a.readText(PAGE);
  else {
    await a.writeText(PAGE, FIXTURE);
    original = FIXTURE;
  }
  assert.ok(listSections(parsePage(original).doc).length >= 1, "fixture has a body-level section");

  try {
    // 2. Edit one field and commit.
    const stamp = "E2E " + new Date().toISOString();
    const edited = editHtml(original, (doc) => {
      const s = sectionElements(doc)[0];
      const f = collectFields(s).find((x) => x.kind === "text" && x.tag === "h2");
      setText(s, f.path, stamp);
    });
    assert.notEqual(edited, original);
    const commit = await a.writeText(PAGE, edited);
    assert.match(commit || "", /^[0-9a-f]{40}$/, "writeText returns the commit sha");

    // 3. A fresh source reads the committed content back byte for byte.
    const b = open();
    assert.equal(await b.readText(PAGE), edited);

    // 4. Stale write: `c` cached the sha before `b` changed the file, so its
    //    write must be refused with the conflict hint, never silently overwrite.
    const c = open();
    await c.listPages(); // caches the current blob sha for every page
    await b.writeText(PAGE, edited.replace(stamp, stamp + " (b)"));
    await assert.rejects(() => c.writeText(PAGE, edited.replace(stamp, stamp + " (c)")), /其他人更新|409|422/);
    assert.equal(await open().readText(PAGE), edited.replace(stamp, stamp + " (b)"), "the stale write changed nothing");
  } finally {
    // 5. Restore, from a fresh source so the sha is current.
    const d = open();
    await d.readText(PAGE);
    await d.writeText(PAGE, original);
    assert.equal(await open().readText(PAGE), original);
  }
});

test("GitHub source: writeFiles lands a page and an image in one commit and refuses stale trees", { skip, timeout: 120_000 }, async () => {
  const { owner, repo } = parseRepo(REPO);
  const branch = process.env.LABSITE_E2E_BRANCH || (await defaultBranch(owner, repo, TOKEN));
  const open = () => githubSource({ owner, repo, branch, token: TOKEN });
  const IMG = "assets/labsite-e2e.png";
  const png = new Blob([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])], { type: "image/png" });

  const a = open();
  const pages = await a.listPages();
  const original = pages.includes(PAGE) ? await a.readText(PAGE) : null;
  const stamp = "E2E writeFiles " + new Date().toISOString();
  const page = (original || FIXTURE).replace(/<h2>[^<]*<\/h2>/, "<h2>" + stamp + "</h2>");
  try {
    const sha = await a.writeFiles([{ path: PAGE, text: page }, { path: IMG, blob: png }], "LabSite e2e：一個 commit 兩個檔案");
    assert.match(sha, /^[0-9a-f]{40}$/);
    const b = open();
    assert.equal(await b.readText(PAGE), page);
    assert.equal((await b.readBlob(IMG)).size, 8);
    // A source that opened before this commit must not be able to overwrite it.
    const stale = open();
    await stale.listPages();
    await open().writeFiles([{ path: PAGE, text: page.replace(stamp, stamp + " (2)") }], "LabSite e2e：中途的另一次提交");
    await assert.rejects(() => stale.writeFiles([{ path: PAGE, text: page.replace(stamp, stamp + " (stale)") }], "m"), /已被其他人更新/);
    assert.equal(await open().readText(PAGE), page.replace(stamp, stamp + " (2)"));
  } finally {
    const d = open();
    await d.listPages();
    await d.writeFiles([{ path: PAGE, text: original || FIXTURE }], "LabSite e2e：還原");
    assert.equal(await open().readText(PAGE), original || FIXTURE);
  }
});
