// The AI assistant's context and how its proposals are checked and applied.
import test from "node:test";
import assert from "node:assert/strict";
import "./dom.js";
const { editHtml } = await import("../src/site/page.js");
const { buildContext, resolveChanges, applyTextChange, applyPublication, newsItem, turnSummary } = await import("../src/site/assistant.js");
const { readNews, writeNews } = await import("../src/site/news.js");

const page = (body, lang = "zh-Hant") => `<!DOCTYPE html>\n<html lang="${lang}">\n<head><title>t</title></head>\n<body>\n${body}\n</body>\n</html>\n`;
const HOME = page(`  <section class="hero">
    <h1>護理創新研究室</h1>
    <p class="lead">我們研究高齡者的認知訓練。</p>
    <a class="btn" href="members.html">認識成員</a>
  </section>
  <section class="section">
    <h2>期刊論文</h2>
    <ol class="pub-list">
      <li class="pub-item"><span class="pub-item__index">1.</span>
        <p class="pub-item__text"><strong>Sung, C. M.</strong>, &amp; Chou, K. R. (2023). The effect of cognitive training. <em>Journal of Advanced Nursing</em>, 79(2), 1-12.</p></li>
      <li class="pub-item"><span class="pub-item__index">2.</span>
        <p class="pub-item__text"><strong>Sung, C. M.</strong> (2022). Another study. <em>Nursing Outlook</em>, 70(1), 3-9.</p></li>
    </ol>
  </section>`);
const HOME_EN = HOME.replace("護理創新研究室", "Nursing Innovation Lab").replace("我們研究高齡者的認知訓練。", "We study cognitive training.").replace("認識成員", "Meet the team").replace("期刊論文", "Journal Articles");
const DATA = `const SITE = {
  nameZh: "護理創新研究室",
  phone: "02-0000-0000",
  email: "lab@example.edu.tw",
};
const CONFIG = {
  SHEET_ID: "",
};
const FALLBACK_NEWS = [
  { date: "2026-10-01", category: "公告", content: "新學期開始", content_en: "New term", link: "" }
];
`;
const labelOf = (x) => ({ "index.html": "首頁", "en/index.html": "首頁", "publications.html": "成果發表" })[x] || x;
const build = (over = {}) =>
  buildContext({ path: "index.html", html: HOME, pairPath: "en/index.html", pairHtml: HOME_EN, siteText: DATA, pages: ["index.html", "publications.html", "en/index.html"], labelOf, ...over });

test("context: text fields of both languages get ids; lists, site values and news are described", () => {
  const { context, index } = build();
  const texts = context.page.fields.map((f) => f.text);
  assert.ok(texts.includes("護理創新研究室") && texts.includes("我們研究高齡者的認知訓練。"));
  assert.ok(!texts.some((t) => /members\.html/.test(t)), "links and images are not offered");
  assert.equal(context.page.language, "zh");
  assert.equal(context.otherLanguage.language, "en");
  assert.ok(context.otherLanguage.fields.some((f) => f.text === "We study cognitive training."));
  const ids = [...context.page.fields, ...context.otherLanguage.fields].map((f) => f.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(index.fields.size, ids.length);
  assert.deepEqual(context.publicationLists, [{ id: "L0", heading: "期刊論文", count: 2, usualBoldName: "Sung, C. M." }]);
  assert.equal(index.lists.get("L0").pair, "en/index.html");
  assert.deepEqual(context.site.map((f) => f.key), ["nameZh", "phone", "email"]);
  assert.equal(context.news.canAdd, true);
  assert.deepEqual(context.news.recent, [{ date: "2026-10-01", category: "公告", zh: "新學期開始" }]);
  assert.deepEqual(context.pages, [{ path: "index.html", title: "首頁" }, { path: "publications.html", title: "成果發表" }]);

  // The block being edited comes first.
  const second = build({ selected: 1 }).context.page.fields[0];
  assert.match(second.where, /期刊論文/);
  // Without the other-language page loaded, only this page is offered.
  const alone = build({ pairHtml: null });
  assert.equal(alone.context.otherLanguage, null);
  assert.equal(alone.index.lists.get("L0").pair, null);
  // A site whose news still comes from a sheet cannot take new items here.
  const sheet = build({ siteText: DATA.replace('SHEET_ID: ""', 'SHEET_ID: "abc123"') });
  assert.equal(sheet.context.news.canAdd, false);
  assert.match(sheet.context.news.why, /試算表/);
});

test("proposals: resolved against the page, refused when stale, applied without touching anything else", () => {
  const { context, index } = build();
  const lead = context.page.fields.find((f) => f.text === "我們研究高齡者的認知訓練。").id;
  const leadEn = context.otherLanguage.fields.find((f) => f.text === "We study cognitive training.").id;
  const cards = resolveChanges(
    [
      { type: "set_text", field: lead, text: "我們研究高齡者的認知訓練與自我照顧。" },
      { type: "set_text", field: leadEn, text: "We study cognitive training and self-care in older adults." },
      { type: "set_text", field: "f999", text: "不存在" },
      { type: "set_text", field: lead, text: "我們研究高齡者的認知訓練。" },
      { type: "add_news", date: "2026/12/5", category: "公告", zh: "王小明論文口試", en: "Thesis defense", link: "" },
      { type: "add_news", date: "2026-10-01", category: "公告", zh: "新學期開始", en: "", link: "" },
      { type: "set_site", key: "phone", value: "02-8792-3100" },
      { type: "set_site", key: "address", value: "台北市" },
      { type: "add_publication", list: "L0", citation: "Wang, X. M., Sung, C. M. (2026). New trial. Journal of Advanced Nursing, 82(3), 1-9.", bold: "Sung, C. M.", journal: "Journal of Advanced Nursing", url: "10.1111/jan.99999" },
      { type: "add_publication", list: "L7", citation: "x", bold: "", journal: "", url: "" },
      { type: "delete_everything" },
    ],
    index,
    { siteText: DATA, labelOf },
  );
  assert.deepEqual(cards.map((c) => c.ok), [true, true, false, false, true, false, true, false, true, false, false]);
  assert.equal(cards[0].before, "我們研究高齡者的認知訓練。");
  assert.match(cards[1].where, /英文頁/);
  assert.match(cards[3].problem, /一樣/);
  assert.equal(cards[4].date, "2026-12-05");
  assert.match(cards[5].problem, /已經有/);
  assert.equal(cards[6].before, "02-0000-0000");
  assert.match(cards[7].problem, /沒有這一欄/);
  assert.match(cards[8].where, /期刊論文（目前 2 篇）.*英文頁/);
  assert.deepEqual(cards[8].preview.parts.filter((x) => x.tag).map((x) => x.tag), ["strong", "em"]);
  assert.equal(cards[8].preview.link.label, "DOI");

  // Text: only that sentence changes.
  const after = editHtml(HOME, applyTextChange(cards[0]));
  assert.equal(after, HOME.replace("我們研究高齡者的認知訓練。", "我們研究高齡者的認知訓練與自我照顧。"));
  // The teacher edited the sentence meanwhile: the proposal no longer applies.
  const edited = HOME.replace("我們研究高齡者的認知訓練。", "我們研究長者。");
  assert.equal(editHtml(edited, applyTextChange(cards[0])), edited);

  // Publication: first in the list, the rest renumbered, on both pages.
  const { list, pairList } = cards[8].target;
  const withPub = editHtml(HOME, applyPublication(cards[8], list));
  assert.match(withPub, /<span class="pub-item__index">1\.<\/span>\s*<p class="pub-item__text">Wang, X\. M\., <strong>Sung, C\. M\.<\/strong> \(2026\)\. New trial\. <em>Journal of Advanced Nursing<\/em>, 82\(3\), 1-9\. <a[^>]*href="https:\/\/doi\.org\/10\.1111\/jan\.99999"/);
  assert.equal((withPub.match(/pub-item__index/g) || []).length, 3);
  assert.match(withPub, /3\.<\/span>\s*<p class="pub-item__text"><strong>Sung, C\. M\.<\/strong> \(2022\)/);
  assert.notEqual(editHtml(HOME_EN, applyPublication(cards[8], pairList)), HOME_EN);
  // The list grew since the assistant read it: do not add on top of a stale view.
  assert.equal(editHtml(withPub, applyPublication(cards[8], list)), withPub);

  // News: written into FALLBACK_NEWS, newest first.
  const items = readNews(writeNews(DATA, [newsItem(cards[4]), ...readNews(DATA).items])).items;
  assert.deepEqual(items.map((x) => [x.date, x.content, x.content_en]), [
    ["2026-12-05", "王小明論文口試", "Thesis defense"],
    ["2026-10-01", "新學期開始", "New term"],
  ]);
});

test("a very long page is truncated instead of sent whole", () => {
  const many = page(
    `  <section class="section"><h2>清單</h2>\n` + Array.from({ length: 900 }, (_, i) => `    <p>第 ${i} 段文字</p>`).join("\n") + `\n  </section>`,
  );
  const { context, index } = buildContext({ path: "index.html", html: many });
  assert.equal(context.page.truncated, true);
  assert.equal(context.page.fields.length, 700);
  assert.equal(index.fields.size, 700);
});

test("turn summary tells the next request what became of each proposal", () => {
  assert.equal(turnSummary({ role: "user", text: "加一則消息" }), "加一則消息");
  assert.equal(
    turnSummary({ role: "assistant", text: "我準備加這一則。", cards: [{ title: "新增一則最新消息", ok: true, state: "applied" }, { title: "修改文字", ok: true }, { title: "修改電話", ok: false }] }),
    "我準備加這一則。\n［新增一則最新消息：已套用］\n［修改文字：還沒決定］\n［修改電話：無法套用］",
  );
});
