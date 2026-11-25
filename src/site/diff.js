// 看改了什麼: what changed between two versions of a site, in words a
// teacher can read — the visible text of each page, section by section,
// rather than HTML. Used by 舊版本 and by the 發布 / 核准 dialogs.
import { parsePage, sectionElements, collectFields, listSections } from "./page.js";

const collapse = (s) => String(s ?? "").replace(/\s+/g, " ").trim();
const MAX_CELLS = 4_000_000;

// Longest-common-subsequence diff of two lists of strings →
// [{ op: "same" | "del" | "add", a?, b? }] (a / b: the items).
export function diffLines(a, b) {
  let start = 0;
  while (start < a.length && start < b.length && a[start] === b[start]) start++;
  let endA = a.length;
  let endB = b.length;
  while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) {
    endA--;
    endB--;
  }
  const head = a.slice(0, start).map((x) => ({ op: "same", a: x, b: x }));
  const tail = a.slice(endA).map((x) => ({ op: "same", a: x, b: x }));
  const A = a.slice(start, endA);
  const B = b.slice(start, endB);
  let middle;
  if (A.length * B.length > MAX_CELLS) {
    // Too big to line up: everything in the middle counts as changed.
    middle = [...A.map((x) => ({ op: "del", a: x })), ...B.map((x) => ({ op: "add", b: x }))];
  } else {
    const n = A.length;
    const m = B.length;
    const L = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
    for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) L[i][j] = A[i] === B[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
    middle = [];
    let i = 0;
    let j = 0;
    while (i < n && j < m) {
      if (A[i] === B[j]) {
        middle.push({ op: "same", a: A[i], b: B[j] });
        i++;
        j++;
      } else if (L[i + 1][j] >= L[i][j + 1]) middle.push({ op: "del", a: A[i++] });
      else middle.push({ op: "add", b: B[j++] });
    }
    while (i < n) middle.push({ op: "del", a: A[i++] });
    while (j < m) middle.push({ op: "add", b: B[j++] });
  }
  return [...head, ...middle, ...tail];
}

// Two wordings of one line → the parts that differ, for highlighting.
// → { before: [{ text, changed }], after: [...] }
export function inlineDiff(before, after) {
  const a = [...String(before)];
  const b = [...String(after)];
  let p = 0;
  while (p < a.length && p < b.length && a[p] === b[p]) p++;
  let s = 0;
  while (s < a.length - p && s < b.length - p && a[a.length - 1 - s] === b[b.length - 1 - s]) s++;
  const parts = (x) =>
    [
      { text: x.slice(0, p).join(""), changed: false },
      { text: x.slice(p, x.length - s).join(""), changed: true },
      { text: x.slice(x.length - s).join(""), changed: false },
    ].filter((y) => y.text);
  return { before: parts(a), after: parts(b) };
}

// A page's visible text, one entry per field, labelled with its section.
// → [{ text, where }]
export function pageLines(html) {
  if (!html) return [];
  const doc = parsePage(html).doc;
  const titles = listSections(doc).map((x) => x.title);
  const out = [];
  sectionElements(doc).forEach((section, i) => {
    for (const f of collectFields(section)) {
      const text =
        f.kind === "text"
          ? collapse(f.value)
          : f.kind === "link"
            ? f.href && "連結：" + f.href
            : f.kind === "image"
              ? f.src && "圖片：" + f.src.split("/").pop() + (f.alt ? "（" + collapse(f.alt) + "）" : "")
              : f.kind === "embed"
                ? f.src && "影片／地圖：" + f.src
                : "";
      if (text) out.push({ text, where: titles[i] || "第 " + (i + 1) + " 段" });
    }
  });
  const title = doc.querySelector("title")?.textContent;
  if (title) out.unshift({ text: "頁面標題：" + collapse(title), where: "分享設定" });
  return out;
}

// A text file (js/data.js and the like) → its non-empty lines.
export const textLines = (text) =>
  String(text || "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((text) => ({ text, where: "" }));

// Two versions of a page or text file → changes grouped by section:
// [{ where, rows: [{ op: "del" | "add" | "change", before?, after? }] }].
export function changes(beforeLines, afterLines) {
  const ops = diffLines(
    beforeLines.map((l) => l.where + "\u0000" + l.text),
    afterLines.map((l) => l.where + "\u0000" + l.text),
  );
  const split = (s) => {
    const k = s.indexOf("\u0000");
    return { where: s.slice(0, k), text: s.slice(k + 1) };
  };
  const groups = [];
  const push = (where, row) => {
    const last = groups[groups.length - 1];
    if (last && last.where === where) last.rows.push(row);
    else groups.push({ where, rows: [row] });
  };
  // Each run of changes between unchanged lines: removed and added lines in
  // the same section are paired up in order as edits; the rest stay
  // removals or additions.
  for (let i = 0; i < ops.length; ) {
    if (ops[i].op === "same") {
      i++;
      continue;
    }
    const dels = [];
    const adds = [];
    for (; i < ops.length && ops[i].op !== "same"; i++) (ops[i].op === "del" ? dels : adds).push(split(ops[i].op === "del" ? ops[i].a : ops[i].b));
    const used = new Set();
    for (const d of dels) {
      const k = adds.findIndex((x, j) => !used.has(j) && x.where === d.where);
      if (k >= 0) {
        used.add(k);
        push(d.where, { op: "change", before: d.text, after: adds[k].text });
      } else push(d.where, { op: "del", before: d.text });
    }
    adds.forEach((x, j) => !used.has(j) && push(x.where, { op: "add", after: x.text }));
  }
  return groups;
}

const TEXT_FILE = /\.(js|json|txt|md|csv)$/i;
const PAGE = /\.html?$/i;
export const fileKind = (path) => (PAGE.test(path) ? "page" : TEXT_FILE.test(path) ? "text" : /\.css$/i.test(path) ? "style" : "file");
