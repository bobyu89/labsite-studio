// 論文清單匯出: the publication lists on the site → a list for a grant report
// or an evaluation (近五年著作目錄), as a Word file or plain text. Bold names
// and italic journals are kept; numbering is redone.
import { sectionElements, nodeAt, collectFields } from "./page.js";
import { publicationLists, citationElement } from "./quickAdd.js";

const collapse = (s) => String(s ?? "").replace(/\s+/g, " ").trim();
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const LEAD_NUMBER = /^\s*\d+\s*[.．、)]\s*/;

// The year a reference was published: "(2024)" / "（2024）" first, else the
// first year-like number.
export function yearOf(text) {
  const t = String(text);
  const m = t.match(/[（(]\s*((?:19|20)\d{2})/) || t.match(/\b((?:19|20)\d{2})\b/);
  return m ? Number(m[1]) : null;
}

// One reference element → { text, html } with only bold / italic kept and
// links written out (a DOI is part of an APA reference).
function readItem(el) {
  const out = [];
  const walk = (node) => {
    for (const n of node.childNodes) {
      if (n.nodeType === 3) out.push(esc(n.nodeValue));
      else if (n.nodeType === 1) {
        const tag = n.tagName.toLowerCase();
        if (tag === "script" || tag === "style") continue;
        if (tag === "a") {
          const href = n.getAttribute("href") || "";
          out.push(/^https?:/.test(href) ? " " + esc(href) : esc(n.textContent));
        } else if (tag === "strong" || tag === "b") out.push("<b>" + inner(n) + "</b>");
        else if (tag === "em" || tag === "i") out.push("<i>" + inner(n) + "</i>");
        else walk(n);
      }
    }
  };
  const inner = (n) => {
    const keep = out.length;
    walk(n);
    return out.splice(keep).join("");
  };
  walk(el);
  const html = collapse(out.join("")).replace(LEAD_NUMBER, "").replace(/\s+([.,;，。])/g, "$1");
  const text = collapse(html.replace(/<[^>]+>/g, "").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&"));
  return { html, text };
}

// A page → [{ page, heading, items: [{ text, html, year }] }]
export function publicationEntries(page, html) {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const out = [];
  for (const list of publicationLists(doc)) {
    const section = sectionElements(doc)[list.section];
    const container = nodeAt(section, list.path);
    const items = [];
    for (const item of container.children) {
      let ref;
      if (list.shape === "citation") ref = readItem(citationElement(item) || item);
      else {
        const parts = collectFields(item, item)
          .filter((f) => f.kind === "text" && !/^\d+[.．、)]?$/.test(collapse(f.value)))
          .map((f) => collapse(f.value).replace(/<[^>]+>/g, ""))
          .filter((v) => v && !/^(全文|Full text|PDF|DOI|連結|Link)$/i.test(v));
        const link = item.querySelector("a[href^='http']")?.getAttribute("href");
        const text = parts.join("．") + (link ? " " + link : "");
        ref = { text, html: esc(text) };
      }
      if (ref.text.length > 8) items.push({ ...ref, year: yearOf(ref.text) });
    }
    if (items.length) out.push({ page, heading: list.heading || "", items });
  }
  return out;
}

export function filterByYear(groups, from, to) {
  return groups
    .map((g) => ({ ...g, items: g.items.filter((x) => x.year === null || ((!from || x.year >= from) && (!to || x.year <= to))) }))
    .filter((g) => g.items.length);
}

// → plain text, one numbered reference per line under each heading.
export function exportText(groups) {
  return groups.map((g) => [g.heading, ...g.items.map((x, i) => `${i + 1}. ${x.text}`)].filter(Boolean).join("\n")).join("\n\n") + "\n";
}

// → an HTML document Word opens as a .doc, references with a hanging indent.
export function exportWord(title, groups) {
  const body = groups
    .map(
      (g) =>
        (g.heading ? `<h2>${esc(g.heading)}</h2>` : "") +
        g.items.map((x, i) => `<p class="ref">${i + 1}. ${x.html}</p>`).join("\n"),
    )
    .join("\n");
  return `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="utf-8"><title>${esc(title)}</title>
<style>
body { font-family: "Times New Roman", "新細明體", serif; font-size: 12pt; line-height: 1.5; }
h1 { font-size: 16pt; } h2 { font-size: 13pt; margin-top: 18pt; }
p.ref { margin: 0 0 6pt 0.5in; text-indent: -0.5in; }
</style></head>
<body>
<h1>${esc(title)}</h1>
${body}
</body></html>
`;
}
