// 論文與成員總表: the site's papers and people as data, read from the pages
// (Chinese and English together) — the first step from "text on pages" to
// "one entry, used everywhere". Each paper knows where it appears; problems
// are flagged: listed twice, missing on the English page, no DOI, no year.
import { parsePage, pairOf, sectionElements, nodeAt } from "./page.js";
import { publicationEntries } from "./pubExport.js";
import { guessJournal } from "./quickAdd.js";
import { memberLists } from "./semester.js";

const collapse = (s) => String(s ?? "").replace(/\s+/g, " ").trim();
const squash = (t) =>
  String(t || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}]+/gu, "");

export function doiIn(text) {
  const m = String(text).match(/\b(10\.\d{4,9}\/[^\s"<>]+?)[.,;)\]]*(?=\s|$)/i);
  return m ? m[1] : "";
}

// APA: "Authors (2024). Title. Journal, …" / 中文: "作者（2024）．題目．期刊，…"
export function titleIn(text) {
  const t = collapse(text);
  const zh = t.match(/[（(]\s*\d{4}[^）)]*[）)]\s*[．.]\s*([^．]+?)\s*[．]/);
  if (zh && /[一-鿿]/.test(zh[1])) return zh[1];
  const en = t.match(/\(\s*\d{4}[a-z]?(?:,[^)]*)?\)\.\s+(.+?[.?!])(?:\s|$)/);
  return en ? en[1].replace(/\.$/, "") : t.slice(0, 80);
}

const keyOf = (p) => (p.doi ? "doi:" + p.doi.toLowerCase() : "t:" + squash(p.title).slice(0, 60));

// pages: [{ path, html }] (publication pages, both languages). →
// { papers: [{ key, title, year, journal, doi, zh: [place], en: [place], flags: [] }],
//   pairs: { zhPage: enPage } }   place: { page, heading, section, path, shape, bold, index, text }
export function paperIndex(pages, allPages) {
  const byPath = new Map(pages.map((x) => [x.path, x.html]));
  const zhPages = pages.map((x) => x.path).filter((x) => !x.startsWith("en/"));
  const papers = new Map();
  const add = (lang, group, item, posKey) => {
    const doi = doiIn(item.text);
    const meta = { title: titleIn(item.text), year: item.year, journal: guessJournal(item.text), doi };
    let key = keyOf(meta);
    if (lang === "en" && !papers.has(key) && posKey && papers.has(posKey)) key = posKey;
    if (!papers.has(key)) papers.set(key, { key, ...meta, zh: [], en: [], flags: [] });
    const paper = papers.get(key);
    if (lang === "zh" || !paper.doi) Object.assign(paper, Object.fromEntries(Object.entries(meta).filter(([, v]) => v)));
    paper[lang].push({ page: group.page, heading: group.heading, section: group.section, path: group.path, shape: group.shape, bold: group.bold, index: item.index, text: item.text });
  };
  const pairs = {};
  for (const zh of zhPages) {
    const zhGroups = publicationEntries(zh, byPath.get(zh) || "");
    const positions = new Map(); // "section|path|index" → key
    for (const g of zhGroups)
      for (const it of g.items) {
        add("zh", g, it);
        positions.set([g.section, g.path.join("."), it.index].join("|"), keyOf({ doi: doiIn(it.text), title: titleIn(it.text) }));
      }
    const en = pairOf(zh, allPages || pages.map((x) => x.path));
    if (en && byPath.has(en)) {
      pairs[zh] = en;
      const enGroups = publicationEntries(en, byPath.get(en));
      // The same list on both pages (copied with 同步): same place, same paper.
      for (const g of enGroups) {
        const same = zhGroups.find((z) => z.section === g.section && z.path.join(".") === g.path.join(".") && z.items.length === g.items.length);
        for (const it of g.items) add("en", g, it, same ? positions.get([g.section, g.path.join("."), it.index].join("|")) : null);
      }
    }
  }
  const list = [...papers.values()];
  for (const p of list) {
    if (p.zh.length > 1 || p.en.length > 1) p.flags.push("duplicate");
    if (p.zh.length && !p.en.length && p.zh.some((x) => pairs[x.page])) p.flags.push("no-en");
    if (!p.zh.length && p.en.length) p.flags.push("no-zh");
    if (!p.doi) p.flags.push("no-doi");
    if (!p.year) p.flags.push("no-year");
  }
  list.sort((a, b) => (b.year || 0) - (a.year || 0) || a.title.localeCompare(b.title));
  return { papers: list, pairs };
}

// The members page (and its English page) → [{ name, role, en: { name, role } | null, photo, place }]
export function peopleIndex(zhPage, zhHtml, enPage, enHtml) {
  const zh = memberLists(parsePage(zhHtml).doc);
  const en = enHtml ? memberLists(parsePage(enHtml).doc) : null;
  const doc = parsePage(zhHtml).doc;
  const out = [];
  zh.current.forEach((list, li) => {
    const enList = en?.current[li];
    const aligned = enList && enList.items.length === list.items.length;
    list.items.forEach((it) => {
      if (!it.name) return;
      const enItem = aligned ? enList.items[it.index] : null;
      out.push({
        name: it.name,
        role: it.role,
        heading: list.heading,
        en: enItem ? { name: enItem.name, role: enItem.role } : null,
        photo: photoOf(doc, list, it.index),
        place: { page: zhPage, section: list.section, index: it.index, enPage: enPage || null },
      });
    });
  });
  return out;
}

// "ok" | "placeholder" (still the template's picture) | "none" (no picture in the entry)
function photoOf(doc, list, index) {
  const item = nodeAt(sectionElements(doc)[list.section], list.path)?.children[index];
  const img = item?.querySelector("img");
  if (!img) return item?.querySelector("[data-photo-slot], .photo-slot") ? "placeholder" : "none";
  return /placeholder|sample|avatar-default/i.test(img.getAttribute("src") || "") ? "placeholder" : "ok";
}
