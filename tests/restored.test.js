// Features restored from the 2026-10-26 deployment, whose source never reached
// GitHub: pre-publish check, 【】 headings, grouped site data, template skins,
// the admin overview.
import test from "node:test";
import assert from "node:assert/strict";
import "./dom.js";
import { fakeEnv } from "./cloud-fakes.js";
import { enc, dec } from "../cloud/src/bytes.js";
import { checkSite, checkPage, resolveLink } from "../src/site/publishCheck.js";
import { readSiteFields, isSampleValue, SITE_FIELDS } from "../src/site/siteData.js";
import { applySkin } from "../cloud/src/templates.js";
import { createApp } from "../cloud/src/api.js";
import { createSite, addMember, commitChanges, publish, getSite } from "../cloud/src/repo.js";
import { createSession } from "../cloud/src/sessions.js";
import { bundleTemplates } from "../tools/bundle-templates.js";
const { parsePage, sectionElements, collectFields, setText, serializePage } = await import("../src/site/page.js");

test("site data fields: labels, where they show, groups, sample values", () => {
  const { fields } = readSiteFields('const SITE = {\n  nameZh: "知行研究室",\n  email: "lab@example.edu.tw",\n  tagline: "範例",\n  custom: "x",\n};');
  const by = Object.fromEntries(fields.map((f) => [f.key, f]));
  assert.equal(by.nameZh.label, "研究室中文名稱");
  assert.equal(by.nameZh.group, "name");
  assert.match(by.email.where, /頁尾/);
  assert.equal(by.tagline.unused, true);
  assert.equal(by.custom.group, "other");
  assert.equal(by.custom.label, "custom");
  assert.ok(isSampleValue("lab@example.edu.tw") && isSampleValue("Zhixing Lab") && !isSampleValue("王老師研究室"));
  assert.equal(SITE_FIELDS.addressEn.label, "地址（英文）");
});

test("pre-publish check: sample text, placeholders, empty and broken links, missing alt", () => {
  assert.equal(resolveLink("en/index.html", "../members.html#x"), "members.html");
  assert.equal(resolveLink("index.html", "research/"), "research/index.html");
  assert.equal(resolveLink("index.html", "../../x.html"), null);
  const page = `<html><head></head><body><h1>範例研究室</h1><script>const x = "範例";</script>
    <img src="assets/placeholder-team.svg" alt="團隊"><img src="a/b.webp">
    <a href="#">空連結</a><a href="">也是空的</a><a href="members.html">成員</a><a href="nope.html">壞掉</a>
    <a href="https://example.org">外部</a><a href="mailto:lab@example.edu.tw">寫信</a></body></html>`;
  const found = checkPage("index.html", page, new Set(["index.html", "members.html"]));
  assert.deepEqual(found.sample, ["範例研究室", "Email 連結：lab@example.edu.tw"]);
  assert.deepEqual(found.placeholder, ["placeholder-team.svg"]);
  assert.deepEqual(found.alt, ["b.webp"]);
  assert.deepEqual(found.empty, ["空連結", "也是空的"]);
  assert.deepEqual(found.broken, ["壞掉 → nope.html"]);
  const site = checkSite({
    pages: [{ path: "index.html", html: page }, { path: "en/index.html", html: "<html><head></head><body><p>Clean.</p></body></html>" }],
    files: new Set(["index.html", "members.html"]),
    siteFields: readSiteFields('const SITE = {\n  nameZh: "範例研究室",\n  tagline: "範例",\n};').fields,
  });
  assert.deepEqual(site.map((c) => [c.kind, c.total]), [["sample", 3], ["placeholder", 1], ["empty", 2], ["broken", 1], ["alt", 1]]);
  assert.equal(site[0].items[0].page, null, "site data first, unused fields skipped");
  assert.deepEqual(checkSite({ pages: [{ path: "a.html", html: "<html><head></head><body><p>ok</p></body></html>" }] }), []);
});

test("【】 headings: one field, accents written back into their own elements", () => {
  const html = '<!doctype html><html><head></head><body><section><h2 class="t">讓<em class="hl">智慧醫療</em>走進現場</h2><p>說明</p></section></body></html>';
  const page = parsePage(html);
  const sec = sectionElements(page.doc)[0];
  const fields = collectFields(sec);
  assert.deepEqual(
    fields.map((f) => [f.kind, f.rich || false, f.value]),
    [["text", true, "讓【智慧醫療】走進現場"], ["text", false, "說明"]],
  );
  assert.equal(setText(sec, fields[0].path, "把【臨床推理】帶進【教室】"), true);
  const out = serializePage(page);
  assert.match(out, /<h2 class="t">把<em class="hl">臨床推理<\/em>帶進<em class="hl">教室<\/em><\/h2>/);
  // A heading with only plain text stays an ordinary text field.
  const plain = sectionElements(parsePage("<!doctype html><html><head></head><body><section><h2>研究領域</h2></section></body></html>").doc)[0];
  assert.equal(collectFields(plain)[0].rich, undefined);
});

test("template skins: index lists them, applySkin swaps the stylesheets", () => {
  const { index, bundles } = bundleTemplates();
  const basic = index.find((t) => t.id === "basic");
  assert.deepEqual(basic.skins.map((s) => s.id), ["guide", "atlas", "notebook", "journal"]);
  assert.equal(basic.skins.find((s) => s.current).id, "guide");
  const files = bundles.basic.files.map((f) => ({ path: f.path, bytes: f.text != null ? enc.encode(f.text) : new Uint8Array() }));
  const out = applySkin(files, "journal");
  const get = (list, p) => dec.decode(list.find((f) => f.path === p).bytes);
  assert.equal(get(out, "css/site.css"), get(files, "labsite/skins/journal/site.css"));
  assert.equal(JSON.parse(get(out, "labsite/skins.json")).current, "journal");
  assert.equal(applySkin(files, ""), files);
  assert.throws(() => applySkin(files, "../x"), /版型代號/);
  assert.throws(() => applySkin(files, "nope"), /沒有版型/);
});

test("admin overview: sites, people, activity, notes; admins only", async () => {
  const env = fakeEnv();
  const T = Date.now();
  const file = (path, text) => ({ path, bytes: enc.encode(text) });
  const sung = await createSite(env, { slug: "sung", name: "宋老師研究室", files: [file("index.html", "<h1>a</h1>")], author: "admin@lab.tw", message: "匯入", now: T - 20 * 86400e3 });
  await publish(env, sung.id, null, { actor: "admin@lab.tw", now: T - 19 * 86400e3 });
  const s = await getSite(env, "sung");
  await commitChanges(env, s.id, { files: [file("index.html", "<h1>b</h1>")], author: "t@lab.tw", message: "改首頁", now: T - 10 * 86400e3 });
  await addMember(env, sung.id, "t@lab.tw", "admin@lab.tw", T - 18 * 86400e3);
  await createSite(env, { slug: "empty", name: "沒人的網站", files: [file("index.html", "x")], author: "admin@lab.tw", message: "匯入", now: T });
  await createSession(env, "t@lab.tw", "invite", T - 86400e3);
  const app = createApp();
  const get = (email) => app.request("http://localhost/api/admin/overview", {}, { ...env, DEV_USER_EMAIL: email });
  assert.equal((await get("t@lab.tw")).status, 403);
  const res = await get("admin@lab.tw");
  assert.equal(res.status, 200);
  const o = await res.json();
  const site = o.sites.find((x) => x.slug === "sung");
  assert.equal(site.pending, 1);
  assert.deepEqual(site.flags, ["stale"]);
  assert.equal(site.lastSave.by, "t@lab.tw");
  assert.deepEqual(site.members, ["t@lab.tw"]);
  assert.equal(site.files, 1);
  assert.deepEqual(o.sites.find((x) => x.slug === "empty").flags, ["nobody"]);
  const t = o.people.find((x) => x.email === "t@lab.tw");
  assert.deepEqual([t.sites, t.hasPassword, t.signedIn], [["宋老師研究室"], false, true]);
  assert.ok(Math.abs(t.lastSeen - (T - 86400e3)) < 5000);
  assert.ok(o.activity.some((a) => a.kind === "save" && a.text === "改首頁"));
  assert.ok(o.activity.some((a) => a.kind === "publish"));
});
