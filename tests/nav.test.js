import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import "./dom.js";
import {
  NAV_FILES,
  readNav,
  writeNav,
  navItems,
  navPages,
  navMove,
  navAddPage,
  navAddGroup,
  navRename,
  navRemove,
  navDropPage,
  navRelabelPage,
  slugFor,
  makePage,
  renamePage,
  sitemapAdd,
  sitemapRemove,
  linksTo,
} from "../src/site/nav.js";
import { parsePage, listSections, sectionElements } from "../src/site/page.js";
import { textBlock } from "../src/site/albums.js";

const [COMPONENTS, DATA] = NAV_FILES;

// The two lab sites' menu (shape and layout copied from js/components.js).
const LAB = [
  "/* header */",
  "const NAV_ITEMS = [",
  '  { key: "index", label: "首頁", labelEn: "Home", href: "index.html" },',
  '  { key: "pi", label: "主持人", labelEn: "PI", href: "pi.html" },',
  '  { key: "research-group", label: "研究", labelEn: "Research", children: [',
  '    { key: "research", label: "研究主題", labelEn: "Research Focus", href: "research.html" },',
  '    { key: "projects", label: "研究計畫", labelEn: "Projects", href: "projects.html" }',
  "  ] },",
  '  { key: "members", label: "團隊成員", labelEn: "Members", href: "members.html" },',
  '  { key: "contact", label: "聯絡我們", labelEn: "Contact", href: "index.html#contact" }',
  "];",
  "",
  "const UI_STRINGS = { zh: { cta: \"加入我們\" } };",
  "",
].join("\n");

const TEMPLATE = fs.readFileSync(new URL("../templates/basic/js/data.js", import.meta.url), "utf8");

test("both menu styles round-trip byte for byte, LF and CRLF", () => {
  for (const [text, spec] of [
    [LAB, COMPONENTS],
    [LAB.replace(/\n/g, "\r\n"), COMPONENTS],
    [TEMPLATE, DATA],
    [TEMPLATE.replace(/\r?\n/g, "\r\n"), DATA],
  ]) {
    const nav = readNav(text, spec);
    assert.ok(nav.ok, nav.error);
    assert.equal(writeNav(text, nav, nav.raw), text);
  }
  // The real sites, when their clones are around (not in CI).
  for (const site of ["sung-lab-website", "ycho-lab-website"]) {
    const file = `C:/Users/USER/Desktop/statpearl/${site}/js/components.js`;
    if (!fs.existsSync(file)) continue;
    const text = fs.readFileSync(file, "utf8");
    const nav = readNav(text, COMPONENTS);
    assert.ok(nav.ok, site + ": " + nav.error);
    assert.equal(writeNav(text, nav, nav.raw), text, site);
  }
});

test("menu items read as one shape for both styles", () => {
  const lab = readNav(LAB, COMPONENTS);
  assert.deepEqual(
    navItems(lab).map((x) => [x.id, x.zh, x.page, x.children?.length ?? null]),
    [
      ["index", "首頁", "index.html", null],
      ["pi", "主持人", "pi.html", null],
      ["research-group", "研究", null, 2],
      ["members", "團隊成員", "members.html", null],
      ["contact", "聯絡我們", null, null],
    ],
  );
  assert.deepEqual(
    navPages(lab).map((x) => [x.page, x.group]),
    [
      ["index.html", null],
      ["pi.html", null],
      ["research.html", "研究"],
      ["projects.html", "研究"],
      ["members.html", null],
    ],
  );
  const tpl = readNav(TEMPLATE, DATA);
  assert.deepEqual(navPages(tpl).map((x) => x.page), ["index.html", "research.html", "members.html", "publications.html", "contact.html"]);
});

test("edits change only the lines they touch and keep each site's layout", () => {
  const nav = readNav(LAB, COMPONENTS);
  const lines = (text) => text.split("\n");
  const diff = (a, b) => lines(b).filter((l) => !lines(a).includes(l));
  // Add a page under the 研究 group: one new line, in the sibling's key order.
  const added = writeNav(LAB, nav, navAddPage(nav, { id: "open-day", zh: "招生說明會", en: "Open Day" }, 2));
  assert.deepEqual(diff(LAB, added), [
    '    { key: "projects", label: "研究計畫", labelEn: "Projects", href: "projects.html" },',
    '    { key: "open-day", label: "招生說明會", labelEn: "Open Day", href: "open-day.html" }',
  ]);
  // Rename keeps everything else.
  const renamed = writeNav(LAB, nav, navRename(nav, [2, 0], { zh: "研究方向" }));
  assert.deepEqual(diff(LAB, renamed), ['    { key: "research", label: "研究方向", labelEn: "Research Focus", href: "research.html" },']);
  // Move a page out of the group to the top level, then into it again.
  const out = navMove(nav, [2, 1], { parent: null, index: 1 });
  assert.deepEqual(out.map((x) => x.key), ["index", "projects", "pi", "research-group", "members", "contact"]);
  const back = navMove({ ...nav, raw: out }, [1], { parent: 3, index: 1 });
  assert.deepEqual(back[2].children.map((x) => x.key), ["research", "projects"]);
  // Groups cannot nest.
  assert.throws(() => navMove(nav, [2], { parent: 3, index: 0 }));
  // New group, then remove an item.
  const grouped = navAddGroup(nav, { id: "group-2", zh: "資源", en: "Resources" }, 4);
  assert.deepEqual(grouped[4], { key: "group-2", label: "資源", labelEn: "Resources", children: [] });
  assert.equal(navRemove(nav, [1]).length, 4);
  // Template menus are flat and use their own keys.
  const tpl = readNav(TEMPLATE, DATA);
  assert.throws(() => navAddGroup(tpl, { id: "g", zh: "x", en: "x" }));
  const tAdded = writeNav(TEMPLATE, tpl, navAddPage(tpl, { id: "news", zh: "最新消息", en: "News" }));
  assert.ok(tAdded.replace(/\r\n/g, "\n").includes('  { page: "news", zh: "最新消息", en: "News" },\n];'));
});

test("dropping a page removes every menu entry for it and empty groups", () => {
  const nav = readNav(LAB, COMPONENTS);
  const once = navDropPage(nav, "projects.html");
  assert.deepEqual(once[2].children.map((x) => x.key), ["research"]);
  const twice = navDropPage({ ...nav, raw: once }, "research.html");
  assert.deepEqual(twice.map((x) => x.key), ["index", "pi", "members", "contact"]);
  const relabelled = navRelabelPage(nav, "research.html", { zh: "研究方向", en: "Research Areas" });
  assert.deepEqual([relabelled[2].children[0].label, relabelled[2].children[0].labelEn], ["研究方向", "Research Areas"]);
});

test("menus that cannot be edited safely say so instead of being rewritten", () => {
  const commented = LAB.replace('  { key: "pi"', '  // the PI page\n  { key: "pi"');
  const nav = readNav(commented, COMPONENTS);
  assert.equal(nav.ok, false);
  assert.match(nav.error, /註解/);
  assert.equal(readNav("const X = 1;", COMPONENTS), null);
});

test("file names come from the English name and never collide", () => {
  assert.equal(slugFor("Open Day"), "open-day");
  assert.equal(slugFor("Teaching & Learning!"), "teaching-and-learning");
  assert.equal(slugFor("招生說明會"), "page");
  assert.equal(slugFor("Members", ["members.html", "en/members.html"]), "members-2");
  assert.equal(slugFor("Café Résumé"), "cafe-resume");
});

const PAGE = [
  "<!DOCTYPE html>",
  '<html lang="zh-Hant">',
  "<head>",
  '  <meta charset="UTF-8">',
  "  <title>團隊成員｜護理研究室</title>",
  '  <meta name="description" content="認識成員。">',
  '  <link rel="canonical" href="https://x.example/lab/members.html">',
  '  <meta property="og:url" content="https://x.example/lab/members.html">',
  '  <meta property="og:title" content="團隊成員｜護理研究室">',
  "</head>",
  "<body>",
  '  <section class="section page-hero">',
  '    <div class="container">',
  '      <span class="mono-en page-hero__label">MEMBERS</span>',
  '      <h1 class="page-hero__title">團隊成員</h1>',
  '      <p class="page-hero__desc">認識研究室的研究團隊成員。</p>',
  "    </div>",
  "  </section>",
  "",
  '  <div class="ecg-divider"></div>',
  "",
  '  <section class="section">',
  '    <div class="container">',
  "      <h2>研究團隊</h2>",
  '      <div class="member-grid"><div class="card">游明勳</div></div>',
  "    </div>",
  "  </section>",
  '  <script src="js/components.js"></script>',
  "  <script>",
  "    initLayout('members');",
  "  </script>",
  "</body>",
  "</html>",
  "",
].join("\n");

test("a new page keeps the frame, takes a new identity, and starts from its banner", () => {
  const out = makePage(PAGE, {
    basePath: "members.html",
    newPath: "open-day.html",
    name: "招生說明會",
    otherName: "Open Day",
    lang: "zh",
    siteLabel: "團隊成員",
    blank: true,
    blockHtml: textBlock({ title: "標題", text: "在這裡輸入內容。" }),
    placeholder: { lede: "在這裡寫一句這一頁的介紹。", description: "招生說明會" },
  });
  const { doc } = parsePage(out);
  assert.equal(doc.title, "招生說明會｜護理研究室");
  assert.equal(doc.querySelector('meta[property="og:title"]').getAttribute("content"), "招生說明會｜護理研究室");
  assert.equal(doc.querySelector('link[rel="canonical"]').getAttribute("href"), "https://x.example/lab/open-day.html");
  assert.equal(doc.querySelector('meta[property="og:url"]').getAttribute("content"), "https://x.example/lab/open-day.html");
  assert.ok(out.includes("initLayout('open-day');"));
  assert.equal(doc.querySelector("h1").textContent, "招生說明會");
  assert.equal(doc.querySelector(".page-hero__label").textContent, "OPEN DAY");
  assert.equal(doc.querySelector(".page-hero__desc").textContent, "在這裡寫一句這一頁的介紹。");
  const sections = listSections(doc);
  assert.deepEqual(sections.map((s) => s.title), ["招生說明會", "標題"]);
  assert.ok(!out.includes("游明勳"));
  assert.equal(doc.querySelectorAll(".ecg-divider").length, 1);
  // Keeping the content: same sections, new banner and identity.
  const copy = makePage(PAGE, {
    basePath: "members.html",
    newPath: "alumni.html",
    name: "畢業校友",
    otherName: "Alumni",
    lang: "zh",
    siteLabel: "團隊成員",
    blank: false,
    placeholder: { lede: "x", description: "畢業校友" },
  });
  assert.ok(copy.includes("游明勳"));
  assert.equal(sectionElements(parsePage(copy).doc).length, 2);
  // The English page of the same site: its kicker takes the English name.
  const en = makePage(PAGE.replace("團隊成員</h1>", "Members</h1>").replace("認識研究室的研究團隊成員。", "Meet the team.").replace("initLayout('members')", "initLayout('members', 'en')"), {
    basePath: "en/members.html",
    newPath: "en/open-day.html",
    name: "Open Day",
    otherName: "招生說明會",
    lang: "en",
    siteLabel: "Members",
    blank: true,
    blockHtml: textBlock({ title: "Heading", text: "Your text here." }),
    placeholder: { lede: "A short introduction to this page.", description: "Open Day" },
  });
  const e = parsePage(en).doc;
  assert.equal(e.querySelector(".page-hero__label").textContent, "OPEN DAY");
  assert.equal(e.querySelector("h1").textContent, "Open Day");
  assert.ok(en.includes("initLayout('open-day', 'en')"));
  // Template pages identify themselves with data-page; the line marked
  // lang="zh-Hant" takes the Chinese name (the real template English page).
  const tplBase = fs.readFileSync(new URL("../templates/basic/en/members.html", import.meta.url), "utf8");
  const tpl = makePage(tplBase, {
    basePath: "en/members.html",
    newPath: "en/news.html",
    name: "News",
    otherName: "最新消息",
    lang: "en",
    siteLabel: "Team",
    blank: true,
    blockHtml: textBlock({ title: "Heading", text: "Your text here." }),
    placeholder: { lede: "A short introduction to this page.", description: "News" },
  });
  assert.match(tpl, /<body data-page="news"/);
  const t = parsePage(tpl).doc;
  assert.equal(t.querySelector(".page-sign__title").textContent, "News");
  assert.equal(t.querySelector(".page-sign__other").textContent, "最新消息");
  assert.equal(t.querySelector(".page-sign__lede").textContent, "A short introduction to this page.");
  assert.match(t.title, /^News/);
  assert.deepEqual(listSections(t).map((s) => s.title), ["News", "Heading"]);
});

test("renaming a page follows its title and banner only where they used the old name", () => {
  const out = renamePage(PAGE, { oldName: "團隊成員", name: "研究夥伴" });
  const { doc } = parsePage(out);
  assert.equal(doc.title, "研究夥伴｜護理研究室");
  assert.equal(doc.querySelector('meta[property="og:title"]').getAttribute("content"), "研究夥伴｜護理研究室");
  assert.equal(doc.querySelector("h1").textContent, "研究夥伴");
  assert.equal(out.split("\n").length, PAGE.split("\n").length);
  assert.equal(renamePage(PAGE, { oldName: "沒有這個", name: "x" }).includes("研究夥伴"), false);
});

const SITEMAP = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  "  <url>",
  "    <loc>https://x.example/lab/members.html</loc>",
  "    <lastmod>2026-07-11</lastmod>",
  '    <xhtml:link rel="alternate" hreflang="en" href="https://x.example/lab/en/members.html"/>',
  "  </url>",
  "  <url>",
  "    <loc>https://x.example/lab/en/members.html</loc>",
  "    <lastmod>2026-07-11</lastmod>",
  "  </url>",
  "</urlset>",
  "",
].join("\n");

test("the sitemap gains and loses entries with the page", () => {
  const added = sitemapAdd(SITEMAP, "members.html", "open-day.html", "2026-10-23");
  assert.equal((added.match(/<url>/g) || []).length, 4);
  assert.ok(added.includes("<loc>https://x.example/lab/open-day.html</loc>"));
  assert.ok(added.includes("<loc>https://x.example/lab/en/open-day.html</loc>"));
  assert.ok(added.includes('href="https://x.example/lab/en/open-day.html"/>'));
  assert.ok(added.includes("<lastmod>2026-10-23</lastmod>"));
  assert.ok(added.trimEnd().endsWith("</urlset>"));
  assert.equal(sitemapAdd(added, "members.html", "open-day.html", "x"), added);
  assert.equal(sitemapRemove(added, "open-day.html"), SITEMAP);
});

test("pages that link to a page are found, from either language folder", () => {
  const texts = {
    "index.html": '<a href="members.html">團隊</a>',
    "en/index.html": '<a href="../members.html#x">中文</a> <a href="members.html">Team</a>',
    "pi.html": '<a href="https://other.example/members.html">x</a>',
    "members.html": '<a href="members.html">self</a>',
  };
  assert.deepEqual(linksTo(texts, "members.html"), ["index.html", "en/index.html"]);
  assert.deepEqual(linksTo(texts, "en/members.html"), ["en/index.html"]);
});
