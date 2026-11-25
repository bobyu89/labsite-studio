// "新增一篇論文" without hunting for the right block: finds the publication
// lists of a page and adds an entry at the top of one, numbered again.
//
// Two shapes of entry are understood, by looking at the list's first item:
//   citation — one paragraph holding the whole reference, with the lab's own
//              name in <strong>, the journal in <em> and a link at the end
//              (宋老師's site). The form takes the pasted reference and puts
//              those marks back.
//   fields   — separate elements for year, title, authors, venue, link (the
//              templates). The form shows one input per element.
import { sectionElements, describeNode, collectFields, nodeAt, addItemAtTop, setText, setAttribute } from "./page.js";

const collapse = (s) => String(s || "").replace(/\s+/g, " ").trim();
const INLINE = new Set(["strong", "b", "em", "i", "a", "span", "mark", "u", "sup", "sub"]);
const NUMBER = /^\d+[.．、)]?$/;

// The paragraph that carries a citation: mostly its own text, only inline children.
export function citationElement(item) {
  let best = null;
  let bestLen = 0;
  for (const el of [item, ...item.querySelectorAll("*")]) {
    if ([...el.children].some((c) => !INLINE.has(c.tagName.toLowerCase()))) continue;
    const own = [...el.childNodes].filter((n) => n.nodeType === 3).reduce((n, t) => n + t.nodeValue.trim().length, 0);
    if (own > bestLen) {
      best = el;
      bestLen = own;
    }
  }
  if (!best || bestLen < 40) return null;
  // Everything else in the item must be the number (or empty), or this is a "fields" entry.
  const rest = collapse(item.textContent.replace(best.textContent, ""));
  return !rest || NUMBER.test(rest) || rest.length <= 4 ? best : null;
}

// The heading a list sits under ("英文期刊", "中文期刊"), else the section's.
function headingFor(container, section) {
  for (let el = container; el && el !== section; el = el.parentElement) {
    for (let prev = el.previousElementSibling; prev; prev = prev.previousElementSibling) {
      if (/^h[1-6]$/i.test(prev.tagName)) return collapse(prev.textContent);
      const inner = prev.querySelector?.("h1, h2, h3, h4, h5, h6");
      if (inner) return collapse(inner.textContent);
    }
  }
  const h = section.querySelector("h1, h2, h3");
  return h ? collapse(h.textContent) : "";
}

const FIELD_HINTS = [
  ["year", "年份"],
  ["date", "日期"],
  ["title", "標題"],
  ["author", "作者"],
  ["venue", "期刊或出處"],
  ["journal", "期刊"],
  ["source", "出處"],
];
const fieldLabel = (el, fallback) => FIELD_HINTS.find(([k]) => (el?.getAttribute?.("class") || "").includes(k))?.[1] || fallback;

const mostCommon = (list) => {
  const count = new Map();
  for (const x of list) if (x) count.set(x, (count.get(x) || 0) + 1);
  return [...count].sort((a, b) => b[1] - a[1])[0]?.[0] || "";
};

// → [{ section, path, heading, count, shape, bold, fields }] for every
// publication list on the page.
export function publicationLists(doc) {
  const out = [];
  sectionElements(doc).forEach((section, index) => {
    for (const list of describeNode(section).lists) {
      if (list.label !== "文獻" || !list.items.length) continue;
      const container = nodeAt(section, list.path);
      const first = container.children[0];
      const cite = citationElement(first);
      const entry = { section: index, path: list.path, heading: headingFor(container, section), count: list.items.length };
      if (cite) {
        const strongs = [...container.querySelectorAll("strong, b")].map((n) => collapse(n.textContent));
        out.push({ ...entry, shape: "citation", bold: mostCommon(strongs) });
      } else {
        const fields = collectFields(first, first)
          .filter((f, i) => f.kind === "link" || (f.kind === "text" && !(list.numbered && i === 0 && NUMBER.test(f.value))))
          // The words of a link ("全文") stay as the template has them.
          .filter((f) => f.kind === "link" || !nodeAt(first, f.elementPath)?.closest?.("a"))
          .map((f) => ({
            kind: f.kind,
            path: f.path,
            label: f.kind === "link" ? "連結網址（DOI 或全文，可留白）" : fieldLabel(nodeAt(first, f.elementPath), f.label),
            example: f.kind === "text" ? f.value : "",
            long: !!f.long,
          }));
        if (fields.length) out.push({ ...entry, shape: "fields", fields });
      }
    }
  });
  return out;
}

// APA-style guess: "(2026). Title. Journal, 12(3), 45–67." → "Journal".
// Chinese references: "（2024）．題目．期刊，71(5)，46-57。" → "期刊".
export function guessJournal(text) {
  const t = collapse(text);
  const zh = t.match(/[（(]\d{4}[^)）]*[)）]\s*[．.]\s*[^．]+[．]\s*([^，,．。]+)[，,]/);
  if (zh && /[一-鿿]/.test(zh[1])) return zh[1].trim();
  const en = t.match(/\(\d{4}[a-z]?(?:,[^)]*)?\)\.\s+(.+?[.?!])\s+([A-Z][^,.]*(?:\.[^,.\d]+)*?)\s*(?:,\s*\d|\.\s*(?:https?:|$)|\.$|,|$)/);
  return en ? en[2].trim() : "";
}

const linkLabel = (url, fallback) =>
  /pubmed|ncbi\.nlm\.nih/i.test(url) ? "PubMed" : /doi\.org|^10\.\d{4,}/i.test(url) ? "DOI" : fallback || "連結";
export const normalizeUrl = (url) => {
  const u = collapse(url);
  if (!u) return "";
  if (/^10\.\d{4,}\//.test(u)) return "https://doi.org/" + u;
  return /^[a-z][a-z0-9+.-]*:/i.test(u) ? u : "https://" + u;
};

// Splits `text` around the first occurrence of each mark, in text order.
function markUp(doc, text, marks) {
  const found = marks
    .map((m) => ({ ...m, at: m.value ? text.indexOf(m.value) : -1 }))
    .filter((m) => m.at >= 0)
    .sort((a, b) => a.at - b.at);
  const nodes = [];
  let pos = 0;
  for (const m of found) {
    if (m.at < pos) continue; // overlaps an earlier mark
    if (m.at > pos) nodes.push(doc.createTextNode(text.slice(pos, m.at)));
    const el = m.make();
    el.textContent = m.value;
    nodes.push(el);
    pos = m.at + m.value.length;
  }
  if (pos < text.length) nodes.push(doc.createTextNode(text.slice(pos)));
  return nodes;
}

// Adds a reference at the top of a "citation" list.
// values: { text, bold, journal, url }
export function addCitation(section, containerPath, values) {
  const text = collapse(values.text);
  if (!text) return false;
  return addItemAtTop(section, containerPath, (item) => {
    const cite = citationElement(item);
    if (!cite) return false;
    const doc = section.ownerDocument;
    const like = (sel, tag) => {
      const model = cite.querySelector(sel);
      return () => (model ? model.cloneNode(false) : doc.createElement(tag));
    };
    const link = cite.querySelector("a");
    const nodes = markUp(doc, text, [
      { value: collapse(values.bold), make: like("strong, b", "strong") },
      { value: collapse(values.journal), make: like("em, i", "em") },
    ]);
    const url = normalizeUrl(values.url);
    if (url) {
      const a = link ? link.cloneNode(false) : doc.createElement("a");
      if (!link) {
        a.setAttribute("target", "_blank");
        a.setAttribute("rel", "noopener noreferrer");
      }
      a.setAttribute("href", url);
      a.textContent = linkLabel(url, link ? collapse(link.textContent) : "");
      nodes.push(doc.createTextNode(" "), a);
    }
    const lead = cite.firstChild?.nodeType === 3 ? cite.firstChild.nodeValue.match(/^\s*/)[0] : "";
    const trail = cite.lastChild?.nodeType === 3 ? cite.lastChild.nodeValue.match(/\s*$/)[0] : "";
    while (cite.firstChild) cite.firstChild.remove();
    if (lead) cite.append(doc.createTextNode(lead));
    cite.append(...nodes);
    if (trail) cite.append(doc.createTextNode(trail));
    return true;
  });
}

// Adds an entry at the top of a "fields" list. values[i] goes to fields[i]
// (as publicationLists listed them); an empty link keeps "#".
export function addFieldsItem(section, containerPath, fields, values) {
  if (!values.some((v) => collapse(v))) return false;
  return addItemAtTop(section, containerPath, (item) => {
    fields.forEach((f, i) => {
      const v = collapse(values[i]);
      if (f.kind === "text") setText(item, f.path, v);
      else setAttribute(item, f.path, "href", v ? normalizeUrl(v) : "#");
    });
    return true;
  });
}

// The same list on the other language's page, when both pages still line up.
export function matchingList(lists, list) {
  return (
    lists.find((l) => l.section === list.section && l.shape === list.shape && l.path.join(".") === list.path.join(".") && l.count === list.count) || null
  );
}

// Used by the 文獻 form's preview: the reference as it will be marked up.
export function previewCitation(values) {
  const text = collapse(values.text);
  const parts = [];
  const marks = [
    { value: collapse(values.bold), tag: "strong" },
    { value: collapse(values.journal), tag: "em" },
  ]
    .map((m) => ({ ...m, at: m.value ? text.indexOf(m.value) : -1 }))
    .filter((m) => m.at >= 0)
    .sort((a, b) => a.at - b.at);
  let pos = 0;
  for (const m of marks) {
    if (m.at < pos) continue;
    if (m.at > pos) parts.push({ text: text.slice(pos, m.at) });
    parts.push({ text: m.value, tag: m.tag });
    pos = m.at + m.value.length;
  }
  if (pos < text.length) parts.push({ text: text.slice(pos) });
  const url = normalizeUrl(values.url);
  return { parts, link: url ? { url, label: linkLabel(url, values.linkLabel) } : null };
}


// Gives the reference at `index` a DOI / full-text link: a "DOI" link after
// a citation, or the entry's link field. Refused when it already has one.
export function addLinkToItem(section, containerPath, index, url, shape) {
  const item = nodeAt(section, containerPath)?.children[index];
  const href = normalizeUrl(url);
  if (!item || !href) return false;
  if (shape === "fields") {
    const a = item.querySelector("a");
    if (!a || (a.getAttribute("href") && a.getAttribute("href") !== "#")) return false;
    a.setAttribute("href", href);
    return true;
  }
  const cite = citationElement(item) || item;
  if (cite.querySelector("a[href^='http']")) return false;
  const doc = section.ownerDocument;
  const a = doc.createElement("a");
  a.setAttribute("href", href);
  a.setAttribute("target", "_blank");
  a.setAttribute("rel", "noopener noreferrer");
  a.textContent = linkLabel(href, "");
  cite.append(doc.createTextNode(" "), a);
  return true;
}
