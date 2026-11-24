// The AI assistant's view of a site, and how its proposals are applied.
//
// The assistant never touches files. The editor sends it what is on screen
// (the open page's text fields, the site-wide values, the publication lists)
// with short ids; it answers with proposals that name those ids; and each
// proposal is checked here against the page as it is now before the teacher
// is offered 套用. A proposal that no longer fits is shown as such, not applied.
import { parsePage, listSections, sectionElements, collectFields, setText } from "./page.js";
import { publicationLists, addCitation, matchingList, previewCitation } from "./quickAdd.js";
import { readNews, normalizeDate, NEWS_CATEGORIES } from "./news.js";
import { readSiteFields, SITE_FIELDS } from "./siteData.js";

// Keeps the request a size the model answers quickly; a publications page
// with hundreds of references still fits.
const MAX_FIELDS = 700;
const MAX_CHARS = 120_000;

const textFields = (html) => {
  const { doc } = parsePage(html);
  const titles = listSections(doc);
  const out = [];
  sectionElements(doc).forEach((el, section) => {
    for (const f of collectFields(el))
      if (f.kind === "text" && f.value.trim())
        out.push({ section, path: f.path, where: (titles[section]?.title || "區塊 " + (section + 1)) + " › " + f.label, value: f.value, rich: !!f.rich });
  });
  return { doc, fields: out };
};

// → { context, index }
// context goes to the server; index (id → where it lives and what it held)
// stays here and is what proposals are resolved against.
export function buildContext({ path, html, pairPath = null, pairHtml = null, siteText = null, pages = [], labelOf = (x) => x, selected = 0 }) {
  const index = { fields: new Map(), lists: new Map(), path, pairPath: pairHtml ? pairPath : null };
  const context = { page: null, otherLanguage: null, site: [], news: null, publicationLists: [], pages: [] };
  let n = 0;
  let chars = 0;
  let truncated = false;
  const add = (page, list) =>
    list.flatMap((f) => {
      if (n >= MAX_FIELDS || chars + f.value.length > MAX_CHARS) {
        truncated = true;
        return [];
      }
      const id = "f" + ++n;
      chars += f.value.length;
      index.fields.set(id, { page, section: f.section, path: f.path, value: f.value, where: f.where });
      return [{ id, where: f.where, text: f.value, ...(f.rich ? { marks: "【】" } : {}) }];
    });

  const here = textFields(html);
  // The block being edited first, so it survives truncation on a very long page.
  const ordered = [...here.fields.filter((f) => f.section === selected), ...here.fields.filter((f) => f.section !== selected)];
  context.page = { path, title: labelOf(path), language: path.startsWith("en/") ? "en" : "zh", fields: add(path, ordered) };

  let pairLists = [];
  if (pairHtml && pairPath) {
    const there = textFields(pairHtml);
    context.otherLanguage = { path: pairPath, language: pairPath.startsWith("en/") ? "en" : "zh", fields: add(pairPath, there.fields) };
    pairLists = publicationLists(there.doc);
  }
  if (truncated) context.page.truncated = true;

  publicationLists(here.doc)
    .filter((l) => l.shape === "citation")
    .forEach((list, i) => {
      const id = "L" + i;
      const mirror = matchingList(pairLists, list);
      index.lists.set(id, { page: path, list, pair: mirror ? pairPath : null, pairList: mirror });
      context.publicationLists.push({ id, heading: list.heading || labelOf(path), count: list.count, usualBoldName: list.bold || "" });
    });

  if (siteText) {
    const site = readSiteFields(siteText);
    if (site.ok) context.site = site.fields.filter((f) => SITE_FIELDS[f.key]).map((f) => ({ key: f.key, label: f.label, value: f.value }));
    const news = readNews(siteText);
    context.news = {
      canAdd: news.ok && !news.sheetId,
      ...(news.ok && news.sheetId ? { why: "這個網站的最新消息目前讀自 Google 試算表；要先到「最新消息」把消息搬進編輯器。" } : {}),
      ...(!news.ok ? { why: "這個網站沒有可以直接編輯的最新消息清單。" } : {}),
      categories: NEWS_CATEGORIES,
      recent: news.ok ? news.items.slice(0, 5).map((x) => ({ date: x.date, category: x.category, zh: x.content })) : [],
    };
  }
  context.pages = pages.filter((x) => !x.startsWith("en/")).map((x) => ({ path: x, title: labelOf(x) }));
  return { context, index };
}

const same = (a, b) => String(a).replace(/\s+/g, " ").trim() === String(b).replace(/\s+/g, " ").trim();

// Turns the server's changes into cards: what will change, where, and
// whether it can still be applied. → [{ ...change, ok, title, where, before?, after, problem? }]
export function resolveChanges(changes, index, { siteText = null, labelOf = (x) => x } = {}) {
  return (changes || []).map((c) => {
    if (c.type === "set_text") {
      const f = index.fields.get(c.field);
      if (!f) return { ...c, ok: false, title: "修改文字", problem: "助手指的那段文字不在這一頁，請再說一次要改哪裡。" };
      const other = f.page !== index.path;
      const base = { ...c, target: f, title: "修改文字", where: (other ? labelOf(f.page) + (f.page.startsWith("en/") ? "（英文頁）" : "（中文頁）") + " · " : "") + f.where, before: f.value, after: c.text };
      if (!c.text.trim()) return { ...base, ok: false, problem: "助手給的是空白文字。要刪掉內容，請在預覽點選後自己清除。" };
      if (same(c.text, f.value)) return { ...base, ok: false, problem: "和現在的文字一樣，不需要修改。" };
      return { ...base, ok: true };
    }
    if (c.type === "add_news") {
      const news = siteText ? readNews(siteText) : null;
      const base = { ...c, date: normalizeDate(c.date), title: "新增一則最新消息" };
      if (!news?.ok) return { ...base, ok: false, problem: "這個網站沒有可以直接編輯的最新消息清單。" };
      if (news.sheetId) return { ...base, ok: false, problem: "這個網站的最新消息目前讀自 Google 試算表。請先到左邊「最新消息」把消息搬進來。" };
      if (news.items.some((x) => x.date === base.date && same(x.content, c.zh))) return { ...base, ok: false, problem: "已經有一則同一天、同樣內容的消息。" };
      return { ...base, ok: true };
    }
    if (c.type === "set_site") {
      const field = siteText ? readSiteFields(siteText).fields.find((f) => f.key === c.key) : null;
      const base = { ...c, title: "修改" + (SITE_FIELDS[c.key]?.label || c.key), where: SITE_FIELDS[c.key]?.where || "", before: field?.value ?? "", after: c.value };
      if (!field) return { ...base, ok: false, problem: "這個網站的資料檔沒有這一欄。" };
      if (same(field.value, c.value)) return { ...base, ok: false, problem: "和現在的內容一樣，不需要修改。" };
      return { ...base, ok: true };
    }
    if (c.type === "add_publication") {
      const t = index.lists.get(c.list);
      const values = { text: c.citation, bold: c.bold, journal: c.journal, url: c.url };
      const base = { ...c, title: "新增一篇論文", values, preview: previewCitation(values) };
      if (!t) return { ...base, ok: false, problem: "找不到要加入的論文清單。請先打開「成果發表」那一頁，或用左邊的「＋ 論文」。" };
      return { ...base, ok: true, target: t, where: (t.list.heading || labelOf(t.page)) + "（目前 " + t.list.count + " 篇）" + (t.pair ? "，英文頁也一起加" : "") };
    }
    return { ...c, ok: false, title: "無法辨識的修改", problem: "這個版本的編輯器不支援這種修改。" };
  });
}

// What the page-editing proposals do to a document. Each returns a mutate
// function for editPage, which reports false when the page has moved on
// (the text was changed since the assistant read it) so nothing is overwritten.
export const applyTextChange = (card) => (doc) => {
  const section = sectionElements(doc)[card.target.section];
  if (!section) return false;
  const now = collectFields(section).find((f) => f.kind === "text" && f.path.join(".") === card.target.path.join("."));
  if (!now || !same(now.value, card.target.value)) return false;
  return setText(section, card.target.path, card.after);
};

export const applyPublication = (card, list) => (doc) => {
  const section = sectionElements(doc)[list.section];
  // Still the list the assistant saw: same place, same number of entries.
  const current = publicationLists(doc).find((l) => l.section === list.section && l.path.join(".") === list.path.join("."));
  if (!section || !current || current.count !== list.count) return false;
  return addCitation(section, list.path, card.values);
};

export const newsItem = (card) => ({ date: card.date, category: card.category, content: card.zh, content_en: card.en || "", link: card.link || "" });

// One line per turn for the next request, so the assistant knows what it
// proposed and what became of it.
export function turnSummary(turn) {
  if (turn.role === "user") return turn.text;
  const cards = (turn.cards || []).map((c) => `［${c.title}：${c.state === "applied" ? "已套用" : c.state === "dismissed" ? "老師說不要" : c.ok ? "還沒決定" : "無法套用"}］`);
  return [turn.text, ...cards].filter(Boolean).join("\n");
}
