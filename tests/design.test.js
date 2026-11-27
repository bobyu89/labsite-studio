// v4.28 設計規範: the standard itself, the six style packs, the automatic
// anti-pattern checks, the lab profile, and theme changes from the assistant.
import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import "./dom.js";
import { DOMParser } from "linkedom";
globalThis.DOMParser = globalThis.DOMParser || DOMParser;

const { DOMAINS, ANTI_PATTERNS, COMMANDS, designBrief, registerOf, antiPattern } = await import("../src/site/design.js");
const { STYLE_PACKS, packById } = await import("../src/site/stylePacks.js");
const { designSite, designPage, imageSize, roleSpellings, loudGradient, bouncyEasing, slowMotion, primaryFonts } = await import("../src/site/designCheck.js");
const { checkSite, DESIGN_KINDS, CHECKS } = await import("../src/site/publishCheck.js");
const { cleanProfile, profileText, profileFromWizard } = await import("../src/site/labProfile.js");
const { contrastIssues, readTheme, patchTheme } = await import("../src/site/themes.js");
const { healthFindings } = await import("../src/site/health.js");
const { resolveChanges } = await import("../src/site/assistant.js");

const ROOT = new URL("../templates/basic/", import.meta.url).pathname;
const walk = (d) => readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : [join(d, f)]));

test("the standard: 8 domains, 34 anti-patterns (25 automatic, 9 for the AI), 12 commands, every reference real", () => {
  assert.deepEqual(Object.keys(DOMAINS), ["type", "color", "space", "motion", "interact", "adapt", "write", "scholar"]);
  const rules = new Set(Object.values(DOMAINS).flatMap((d) => d.rules.map(([id]) => id)));
  assert.equal(rules.size, Object.values(DOMAINS).reduce((n, d) => n + d.rules.length, 0), "rule ids are unique");
  assert.equal(ANTI_PATTERNS.length, 34);
  assert.equal(new Set(ANTI_PATTERNS.map((a) => a.id)).size, 34);
  assert.equal(ANTI_PATTERNS.filter((a) => a.detect === "auto").length, 25);
  assert.equal(ANTI_PATTERNS.filter((a) => a.detect === "ai").length, 9);
  for (const a of ANTI_PATTERNS) assert.ok(rules.has(a.rule), a.id + " cites " + a.rule);
  // Every automatic one is checked: by designCheck (DESIGN_KINDS) or an older check (kind).
  for (const a of ANTI_PATTERNS.filter((x) => x.detect === "auto")) assert.ok(DESIGN_KINDS.includes(a.id) || a.kind, a.id + " is checked somewhere");
  assert.equal(DESIGN_KINDS.length, 18, "18 new automatic checks");
  for (const k of DESIGN_KINDS) assert.ok(CHECKS.find((c) => c.kind === k), k + " has a check entry");
  assert.equal(COMMANDS.length, 12);
  for (const c of COMMANDS) {
    for (const d of c.domains) assert.ok(DOMAINS[d], c.id + " domain " + d);
    if (!c.local) assert.ok(c.ask.length > 20, c.id + " has a request");
  }
  assert.deepEqual(COMMANDS.filter((c) => c.changes.includes("set_theme")).map((c) => c.id), ["quieter", "bolder"]);
});

test("designBrief: only the chosen domains, the page's register and the lab profile", () => {
  const all = designBrief();
  assert.match(all, /\[T-01\][\s\S]*\[A-07\][\s\S]*\[AP-34\]/);
  const one = designBrief({ domains: ["write"], register: "showcase", lab: "## 研究室檔案\n語氣：溫和", antiPatterns: false });
  assert.match(one, /\[W-01\]/);
  assert.doesNotMatch(one, /\[T-01\]|\[AP-01\]/);
  assert.match(one, /門面頁/);
  assert.match(one, /語氣：溫和/);
  assert.deepEqual(["index.html", "en/index.html", "research.html", "members.html", "publications.html", "en/contact.html"].map(registerOf), ["showcase", "showcase", "showcase", "record", "record", "record"]);
});

test("style packs: six, each on a real skin, readable (contrast), and every colour lands in that skin's theme.css", () => {
  const skins = JSON.parse(readFileSync(ROOT + "labsite/skins.json", "utf8")).skins.map((s) => s.id);
  assert.equal(STYLE_PACKS.length, 6);
  for (const pack of STYLE_PACKS) {
    assert.ok(skins.includes(pack.skin), pack.id + " skin " + pack.skin);
    assert.deepEqual(contrastIssues({ "--on-zone": "#ffffff", "--on-join": "#ffffff", ...pack.vars }), [], pack.id + " contrast");
    const css = readFileSync(pack.skin === "guide" ? ROOT + "css/theme.css" : ROOT + `labsite/skins/${pack.skin}/theme.css`, "utf8");
    const declared = readTheme(css).vars;
    for (const k of Object.keys(pack.vars)) assert.ok(Object.hasOwn(declared, k), `${pack.id}: ${k} is declared by ${pack.skin}`);
    const patched = readTheme(patchTheme(css, { vars: pack.vars, fontUrl: pack.fontUrl }));
    assert.equal(patched.vars["--zone-research"], pack.vars["--zone-research"]);
    assert.equal(patched.fontUrl, pack.fontUrl);
    // The fonts the pack names are the fonts it loads.
    for (const f of [pack.vars["--font"], pack.vars["--font-label"]].filter(Boolean)) {
      const first = f.split(",")[0].replace(/"/g, "").trim();
      assert.ok(pack.fontUrl.includes(first.replace(/ /g, "+")), `${pack.id} loads ${first}`);
    }
  }
  assert.equal(packById("calm").name, "靜心照護");
  assert.equal(packById("nope"), null);
});

test("the templates pass every new check, on all four skins", () => {
  const all = walk(ROOT).map((f) => relative(ROOT, f));
  const pages = all.filter((f) => f.endsWith(".html") && !f.startsWith("labsite")).map((path) => ({ path, html: readFileSync(ROOT + path, "utf8") }));
  const sizes = all.map((path) => ({ path, size: statSync(ROOT + path).size }));
  for (const dir of ["css/", "labsite/skins/atlas/", "labsite/skins/journal/", "labsite/skins/notebook/"]) {
    const styles = ["theme.css", "site.css"].map((f) => ({ path: dir + f, text: readFileSync(ROOT + dir + f, "utf8") }));
    assert.deepEqual(designSite({ pages, styles, files: sizes }), {}, dir);
  }
  // And with each style pack applied.
  for (const pack of STYLE_PACKS) {
    const dir = pack.skin === "guide" ? "css/" : `labsite/skins/${pack.skin}/`;
    const theme = patchTheme(readFileSync(ROOT + dir + "theme.css", "utf8"), { vars: pack.vars, fontUrl: pack.fontUrl });
    assert.deepEqual(designSite({ pages, styles: [{ path: "css/theme.css", text: theme }, { path: "css/site.css", text: readFileSync(ROOT + dir + "site.css", "utf8") }] }), {}, pack.id);
  }
});

test("the anti-patterns are found: AI look, old-style sites, unreadable bits", () => {
  const card = (t) => `<div class="card"><h3>${t}</h3></div>`;
  const row = `<section><div class="grid">${card("a")}${card("b")}${card("c")}</div></section>`;
  const html = `<html lang="zh"><head><meta name="viewport" content="width=device-width"></head><body>
    <section style="background: linear-gradient(135deg, #7c3aed, #2563eb); text-align:center"><h1>🚀 致力於打造全方位卓越的研究</h1></section>
    ${row}${row}${row}
    <section class="text-center"><div class="card"><div class="card">nested</div></div></section>
    <section class="center"><ul><li>✨ 第一點</li></ul><p style="background:#0b6e69;color:#9a9a9a">灰字在色塊上</p></section>
    <section data-aos="fade-up"><p>您是第 1234 位訪客，最佳解析度 1024x768</p><marquee>跑馬燈</marquee></section>
    <section><a href="files/brochure.pdf">招生簡章</a><a href="more.html">more</a><h3>跳級</h3>
    <p style="font-size:11px">a</p><p style="font-size:12px">b</p><p style="font-size:13px">c</p><p style="font-size:15px">d</p><p style="font-size:19px">e</p><p style="font-size:23px">f</p>
    <p style="font-family: Comic Sans MS">字</p><div class="carousel slide" data-bs-ride="carousel"></div></section>
    <img src="assets/hero.jpg" alt="x"></body></html>`;
  const css = `.a{transition: transform 1.2s cubic-bezier(.68,-0.55,.27,1.55)} h1{font-family: Georgia, serif} .b{font-family:"Lobster"} .c{font-family:Roboto}`;
  // A page that is nothing but card rows and centred blocks.
  const cards = `<html><body><section class="text-center">${row.slice(9)}<section class="text-center">${row.slice(9)}<section class="center">${row.slice(9)}<section><p>x</p></section></body></html>`;
  const found = designSite({ pages: [{ path: "index.html", html }, { path: "cards.html", html: cards }], styles: [{ path: "css/x.css", text: css }], files: [{ path: "assets/hero.jpg", size: 2_400_000 }] });
  assert.deepEqual([found["AP-02"][0].page, found["AP-05"][0].page], ["cards.html", "cards.html"]);
  const ids = Object.keys(found).sort();
  assert.deepEqual(ids, ["AP-01", "AP-02", "AP-03", "AP-04", "AP-05", "AP-06", "AP-07", "AP-08", "AP-11", "AP-12", "AP-14", "AP-15", "AP-16", "AP-19", "AP-21", "AP-24", "AP-25"]);
  assert.match(found["AP-08"][0].examples[0], /「致力於」/);
  assert.match(found["AP-25"][0].examples[0], /hero\.jpg（2\.3 MB）/);
  assert.match(found["AP-07"].map((x) => x.examples.join()).join(), /捲到才出現[\s\S]*彈跳[\s\S]*1200ms/);
  // Through checkSite they become check groups with the rule cited.
  const groups = checkSite({ pages: [{ path: "index.html", html }], design: { styles: [{ path: "css/x.css", text: css }], sizes: [] } });
  const g = groups.find((c) => c.kind === "AP-08");
  assert.equal(g.design, true);
  assert.match(g.hint, /設計規範 W-03/);
});

test("quiet things stay quiet: a highlighter stripe, a mask fade, one emoji-free page", () => {
  assert.equal(loudGradient("linear-gradient(transparent 58%, #ffd866 58% 90%, transparent 90%)"), false);
  assert.equal(loudGradient("linear-gradient(to right, #000 85%, transparent)"), false);
  assert.equal(loudGradient("linear-gradient(#0b6e69, #0e8a83)"), false, "one hue is fine");
  assert.equal(loudGradient("linear-gradient(90deg, rgb(124, 58, 237), rgb(37, 99, 235))"), true);
  assert.equal(bouncyEasing("transition: transform .3s cubic-bezier(0.16, 1, 0.3, 1)"), false);
  assert.equal(bouncyEasing("animation: bounce 1s"), true);
  assert.deepEqual(slowMotion("transition: opacity .3s, transform 450ms; animation: m-failsafe 0.01s 2.5s forwards; animation: spin 3s linear infinite"), []);
  assert.deepEqual([...primaryFonts(`:root{--font: "Overpass", "Noto Sans TC"} body{font-family: var(--font)}`)], ["overpass"]);
  const plain = designPage("a.html", "<html><body><section><h2>研究主題</h2><p>我們研究長輩跌倒。</p><a href='p.pdf'>招生簡章（PDF，1.2 MB）</a></section></body></html>");
  assert.deepEqual(plain.found, {});
});

test("member photos and roles: shapes from image headers, roles written two ways", () => {
  const png = (w, h) => {
    const b = new Uint8Array(33);
    b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]);
    new DataView(b.buffer).setUint32(16, w);
    new DataView(b.buffer).setUint32(20, h);
    return b;
  };
  const jpeg = (w, h) => new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 4, 0, 0, 0xff, 0xc0, 0, 17, 8, h >> 8, h & 255, w >> 8, w & 255, 3, 0, 0, 0, 0]);
  const gif = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 40, 0, 30, 0, 0, 0]);
  const webp = new Uint8Array(30);
  webp.set([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50, 0x56, 0x50, 0x38, 0x58]);
  webp.set([99, 0, 0, 49, 0, 0], 24);
  assert.deepEqual([imageSize(png(400, 500)), imageSize(jpeg(640, 480)), imageSize(gif), imageSize(webp), imageSize(new Uint8Array([1, 2, 3]))], [
    { w: 400, h: 500 },
    { w: 640, h: 480 },
    { w: 40, h: 30 },
    { w: 100, h: 50 },
    null,
  ]);
  assert.deepEqual(roleSpellings(["碩一", "碩二", "博士班三年級", "博三"]), ["博士寫成 2 種：博士班一年級／博一"]);
  assert.deepEqual(roleSpellings(["碩一", "碩二", "博士後研究員", "博二"]), []);
  assert.deepEqual(roleSpellings(["碩士班研究生", "碩士班研究生（共同指導）", "助理教授", "研究助理"]), [], "notes in brackets and 助理教授 are not other spellings");
  const r = designSite({ members: { page: "members.html", roles: ["碩一", "碩士班二年級"], dims: [{ w: 400, h: 400 }, { w: 400, h: 400 }, { w: 400, h: 600 }] } });
  assert.deepEqual(r["AP-29"][0].examples, ["成員照片的長寬比從 0.67 到 1.00", "碩士寫成 2 種：碩一／碩士班一年級"]);
});

test("研究室檔案: cleaned, written out for the AI, built from the wizard's answers", () => {
  assert.deepEqual(cleanProfile({ oneLine: "  我們研究…  ", tone: "", junk: 1, pack: "Calm!" }), { oneLine: "我們研究…" });
  assert.deepEqual(cleanProfile({ pack: "calm", avoid: "x".repeat(400) }).avoid.length, 300);
  const text = profileText({ oneLine: "我們研究照顧者", tone: "溫和" }, { name: "社區研究室", nameEn: "Community Lab", packName: "社區溫度" });
  assert.match(text, /研究室：社區研究室 Community Lab\n風格包：社區溫度\n一句話介紹：我們研究照顧者\n語氣：溫和/);
  assert.equal(profileText({}), "");
  assert.deepEqual(profileFromWizard({ audience: ["學生", "醫院"], mood: "親切", tone: "口語", oneLine: "一句", pack: "community" }), { oneLine: "一句", audience: "學生、醫院", impression: "親切", tone: "口語", pack: "community" });
});

test("網站體檢 lists the design findings with their rule", () => {
  const f = healthFindings({ checks: [{ kind: "AP-19", total: 2 }, { kind: "AP-04", total: 1 }, { kind: "sample", total: 1 }] });
  assert.deepEqual(f.map((x) => x.id), ["sample", "AP-19", "AP-04"]);
  assert.equal(f[1].rule, "C-02");
  assert.match(f[1].title, /2 處/);
  assert.equal(antiPattern("AP-04").rule, "T-03");
});

test("assistant theme proposals: shown as before → after, refused when unreadable, unchanged or without a theme", () => {
  const theme = { vars: { "--zone-research": "#0b6e69", "--zone-team": "#1f4e8c", "--zone-publications": "#a8352b", "--zone-join": "#8e2a5e", "--ink": "#14181c", "--ink-soft": "#46525c", "--wall": "#e6eaec", "--plate": "#ffffff", "--motion": "subtle", "--radius": "4px" } };
  const index = { fields: new Map(), lists: new Map(), repeats: new Map(), path: "index.html" };
  const [ok, bad, same] = resolveChanges(
    [
      { type: "set_theme", vars: { "--motion": "none", "--zone-research": "#2f4a62" }, reason: "安靜一點" },
      { type: "set_theme", vars: { "--zone-research": "#9fd8d4" } },
      { type: "set_theme", vars: { "--radius": "4px" } },
    ],
    index,
    { theme },
  );
  assert.equal(ok.ok, true);
  assert.deepEqual(ok.rows.map((r) => [r.label, r.before, r.after]), [["動態", "subtle", "none"], ["研究的顏色", "#0b6e69", "#2f4a62"]]);
  assert.equal(bad.ok, false);
  assert.match(bad.problem, /不夠清楚/);
  assert.equal(same.ok, false);
  const [noTheme] = resolveChanges([{ type: "set_theme", vars: { "--motion": "none" } }], index, { theme: null });
  assert.equal(noTheme.ok, false);
});

test("docs/DESIGN-STANDARD.md lists every rule, anti-pattern and command the code uses", () => {
  const doc = readFileSync(new URL("../docs/DESIGN-STANDARD.md", import.meta.url), "utf8");
  for (const d of Object.values(DOMAINS)) for (const [id] of d.rules) assert.ok(doc.includes(`**${id}**`), id);
  for (const a of ANTI_PATTERNS) assert.ok(doc.includes(`| ${a.id} |`), a.id);
  for (const c of COMMANDS) assert.ok(doc.includes(`（${c.id}）`), c.id);
  for (const p of STYLE_PACKS) assert.ok(doc.includes(p.name), p.id);
});
