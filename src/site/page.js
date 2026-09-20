// Page model for real static sites: parse HTML, expose sections and editable
// fields, apply edits, and serialize back with the original formatting intact.
// Uses the global DOMParser (browser, or linkedom in tests).

const SKIP_TAGS = new Set([
  "script",
  "style",
  "svg",
  "noscript",
  "template",
  "iframe",
  "input",
  "textarea",
  "select",
]);
const INLINE_TAGS = new Set([
  "span",
  "a",
  "strong",
  "em",
  "b",
  "i",
  "small",
  "code",
  "sup",
  "sub",
  "br",
  "time",
  "mark",
  "abbr",
  "u",
]);
export const TAG_LABELS = {
  h1: "主標題",
  h2: "區塊標題",
  h3: "小標題",
  h4: "子標題",
  h5: "子標題",
  h6: "子標題",
  p: "段落",
  li: "清單項目",
  span: "文字",
  a: "連結",
  button: "按鈕",
  label: "欄位標籤",
  option: "選項",
  figcaption: "圖說",
  time: "時間",
  td: "表格內容",
  th: "表格標題",
  dt: "名稱",
  dd: "內容",
  strong: "粗體",
  em: "強調",
  b: "粗體",
  i: "斜體",
  small: "小字",
  blockquote: "引言",
  div: "文字區",
  img: "圖片",
};

/* ------------------------------------------------------- parse / serialize */
export function parsePage(html) {
  if (typeof html !== "string") throw new Error("頁面內容必須是文字。");
  const eol = html.includes("\r\n") ? "\r\n" : "\n";
  const text = html.replace(/\r\n?/g, "\n");
  const doctype = (text.match(/^﻿?\s*<!doctype[^>]*>/i) || [
    "<!DOCTYPE html>",
  ])[0].trim();
  const headGap = (text.match(/<html[^>]*>(\s*)<head/i) || ["", ""])[1];
  const tail = text.match(/(\s*)<\/body>(\s*)<\/html>(\s*)$/i);
  const meta = {
    eol,
    doctype,
    headGap,
    bodyGap: tail ? tail[1] : "\n",
    tailInner: tail ? tail[2] : "\n",
    tailOuter: tail ? tail[3] : "\n",
    ...collectOriginals(text),
  };
  const doc = new DOMParser().parseFromString(text, "text/html");
  return { doc, meta };
}

export function serializePage({ doc, meta }) {
  let out = doc.documentElement.outerHTML;
  // Parsers move whitespace after </body> and </html> into the body; put the
  // original tail back exactly as it was.
  out = out.replace(
    /\s*<\/body>\s*<\/html>\s*$/,
    () => meta.bodyGap + "</body>" + meta.tailInner + "</html>" + meta.tailOuter,
  );
  if (meta.headGap)
    out = out.replace(/^(<html[^>]*>)<head/, (_, open) => open + meta.headGap + "<head");
  out = out.replace(SVG_LEAF, "<$1$2/>").replace(SVG_SPACED, "<$1$2/>");
  out = restoreOriginals(out, meta);
  out = meta.doctype + "\n" + out;
  return meta.eol === "\r\n" ? out.replace(/\n/g, "\r\n") : out;
}

export const roundTrip = (html) => serializePage(parsePage(html));

/* Browsers re-serialise every tag and text run in a canonical form: attributes
   joined by one space, values double-quoted with & and " escaped, valueless
   attributes as name="", entities normalised, empty SVG leaves as <path></path>.
   We predict that canonical form for each original tag and text run that
   differs from it, and swap the original back in after serialisation. Anything
   the user actually edited no longer matches and simply keeps the browser's
   form, so a saved file differs from the original only where content changed. */
const SVG_TAGS =
  "rect|stop|path|circle|line|polyline|polygon|ellipse|use|image|animate";
const SVG_LEAF = new RegExp("<(" + SVG_TAGS + ")((?:\\s[^<>]*)?)></\\1>", "g");
const SVG_SPACED = new RegExp("<(" + SVG_TAGS + ")((?:\\s[^<>]*?)?)\\s/>", "g");
const TAG_RE = /<[a-zA-Z][^<>]*>/g;
const ATTR_RE = /([^\s"'<>\/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
const NAMED = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  copy: "©",
  reg: "®",
  times: "×",
  mdash: "—",
  ndash: "–",
  hellip: "…",
  laquo: "«",
  raquo: "»",
  middot: "·",
  bull: "•",
  trade: "™",
  deg: "°",
};
function decodeEntities(s) {
  return s.replace(/&(#x[0-9a-fA-F]+|#[0-9]+|[a-zA-Z]+);/g, (m, e) => {
    if (e[0] === "#")
      return String.fromCodePoint(
        e[1] === "x" || e[1] === "X"
          ? parseInt(e.slice(2), 16)
          : parseInt(e.slice(1), 10),
      );
    return Object.hasOwn(NAMED, e) ? NAMED[e] : m;
  });
}
const escapeAttr = (v) =>
  v.replace(/&/g, "&amp;").replace(/ /g, "&nbsp;").replace(/"/g, "&quot;");
const escapeText = (v) =>
  v
    .replace(/&/g, "&amp;")
    .replace(/ /g, "&nbsp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
function canonicalTag(tag) {
  const m = tag.match(/^<([a-zA-Z][^\s\/>]*)([\s\S]*?)(\/?)>$/);
  if (!m) return null;
  const attrs = [];
  for (const a of m[2].matchAll(ATTR_RE)) {
    const value = a[2] ?? a[3] ?? a[4] ?? "";
    attrs.push(" " + a[1] + '="' + escapeAttr(decodeEntities(value)) + '"');
  }
  return "<" + m[1] + attrs.join("") + m[3] + ">";
}
function collectOriginals(text) {
  const tags = new Map();
  for (const tag of text.match(TAG_RE) || []) {
    const canon = canonicalTag(tag);
    if (canon && canon !== tag && !tags.has(canon)) tags.set(canon, tag);
  }
  const texts = new Map();
  for (const m of text.matchAll(/>([^<]*&[^<]*)</g)) {
    const run = m[1];
    const canon = escapeText(decodeEntities(run));
    if (canon !== run && !texts.has(canon)) texts.set(canon, run);
  }
  return { tags, texts };
}
function restoreOriginals(out, meta) {
  if (meta.tags?.size)
    out = out.replace(TAG_RE, (tag) => meta.tags.get(tag) ?? tag);
  if (meta.texts?.size)
    out = out.replace(
      />([^<]+)</g,
      (m, run) => ">" + (meta.texts.get(run) ?? run) + "<",
    );
  return out;
}

/* ------------------------------------------------------------------ sections */
export function sectionElements(doc) {
  return [...doc.body.children].filter(
    (el) => el.tagName.toLowerCase() === "section",
  );
}
const collapse = (s) => s.replace(/\s+/g, " ").trim();
export function sectionSummary(el, index) {
  const heading = el.querySelector("h1, h2, h3");
  const title =
    (heading && collapse(heading.textContent)) ||
    (el.id && "#" + el.id) ||
    "區塊 " + (index + 1);
  const kind =
    el.classList.contains("hero") || el.classList.contains("page-hero")
      ? "主視覺"
      : el.querySelector("form")
        ? "表單"
        : "內容";
  return {
    index,
    id: el.id || "",
    title: title.slice(0, 40),
    kind,
    className: el.className,
  };
}
export function listSections(doc) {
  return sectionElements(doc).map(sectionSummary);
}

// A section travels with the comment banner that introduces it (comments and
// whitespace immediately before it, up to the previous element).
function leadingNodes(section) {
  const nodes = [];
  let n = section.previousSibling;
  while (n && (n.nodeType === 8 || (n.nodeType === 3 && !n.nodeValue.trim()))) {
    nodes.unshift(n);
    n = n.previousSibling;
  }
  while (nodes.length && nodes[0].nodeType === 3) nodes.shift();
  return nodes;
}
const unitOf = (section) => [...leadingNodes(section), section];

// Moves a section to another slot while leaving dividers and other siblings
// in place, so the alternating "section / divider" rhythm survives.
export function moveSection(doc, from, to) {
  const sections = sectionElements(doc);
  if (
    from === to ||
    from < 0 ||
    to < 0 ||
    from >= sections.length ||
    to >= sections.length
  )
    return false;
  const units = sections.map(unitOf);
  const slots = units.map((unit) => {
    const marker = doc.createComment("labsite-slot");
    unit[0].before(marker);
    unit.forEach((n) => n.remove());
    return marker;
  });
  const order = units.slice();
  const [moved] = order.splice(from, 1);
  order.splice(to, 0, moved);
  slots.forEach((marker, i) => {
    marker.replaceWith(...order[i]);
  });
  return true;
}
function isDivider(node) {
  return (
    !!node &&
    node.nodeType === 1 &&
    node.tagName.toLowerCase() !== "section" &&
    /divider/.test(node.getAttribute("class") || "")
  );
}
function nextMeaningful(node) {
  let n = node.nextSibling;
  while (n && n.nodeType === 3 && !n.nodeValue.trim()) n = n.nextSibling;
  return n;
}
function prevMeaningful(node) {
  let n = node.previousSibling;
  while (n && (n.nodeType === 8 || (n.nodeType === 3 && !n.nodeValue.trim())))
    n = n.previousSibling;
  return n;
}
function removeWithWhitespace(node) {
  const ws = node.previousSibling;
  if (ws && ws.nodeType === 3 && !ws.nodeValue.trim()) ws.remove();
  node.remove();
}
export function removeSection(doc, index) {
  const sections = sectionElements(doc);
  const el = sections[index];
  if (!el || sections.length === 1) return false;
  const after = nextMeaningful(el);
  const before = prevMeaningful(el);
  if (isDivider(after)) removeWithWhitespace(after);
  else if (isDivider(before)) removeWithWhitespace(before);
  for (const n of leadingNodes(el)) removeWithWhitespace(n);
  removeWithWhitespace(el);
  return true;
}
export function duplicateSection(doc, index) {
  const sections = sectionElements(doc);
  const el = sections[index];
  if (!el || sections.length >= 60) return false;
  const copy = el.cloneNode(true);
  copy.removeAttribute("id");
  copy.querySelectorAll("[id]").forEach((n) => n.removeAttribute("id"));
  const gap =
    el.previousSibling && el.previousSibling.nodeType === 3
      ? el.previousSibling.nodeValue
      : "\n";
  // Banner comments (and the whitespace between them) are cloned with the copy.
  const banner = leadingNodes(el).map((n) => n.cloneNode(true));
  const after = nextMeaningful(el);
  const anchor = isDivider(after) ? after : el;
  const divider = isDivider(after)
    ? after.cloneNode(true)
    : Object.assign(doc.createElement("div"), { className: "ecg-divider" });
  const block = banner.length ? [doc.createTextNode(gap), ...banner, doc.createTextNode(gap), copy] : [doc.createTextNode(gap), copy];
  if (isDivider(after)) anchor.after(...block, doc.createTextNode(gap), divider);
  else anchor.after(doc.createTextNode(gap), divider, ...block);
  return true;
}

/* -------------------------------------------------------------------- fields */
function childIndex(node) {
  return [...node.parentNode.childNodes].indexOf(node);
}
export function pathOf(node, root) {
  const path = [];
  let n = node;
  while (n && n !== root) {
    path.unshift(childIndex(n));
    n = n.parentNode;
  }
  return n === root ? path : null;
}
export function nodeAt(root, path) {
  let n = root;
  for (const i of path) n = n && n.childNodes[i];
  return n || null;
}
function describe(el) {
  const tag = el.tagName.toLowerCase();
  const cls = [...el.classList].find((c) => !/^(reveal|in|mono-en)$/.test(c));
  const hints = [
    ["chip", "標籤"],
    ["btn", "按鈕"],
    ["title", "標題"],
    ["label", "標籤文字"],
    ["desc", "說明"],
    ["role", "職稱"],
    ["name", "名稱"],
    ["subtitle", "副標"],
    ["eyebrow", "眉標"],
  ];
  const hint = cls ? hints.find(([k]) => cls.includes(k))?.[1] : "";
  return hint || TAG_LABELS[tag] || tag;
}
// Walks a section and returns editable leaves: text nodes, images and links.
export function collectFields(section) {
  const fields = [];
  const walk = (el, context) => {
    const tag = el.tagName.toLowerCase();
    if (SKIP_TAGS.has(tag)) return;
    if (tag === "img") {
      fields.push({
        kind: "image",
        path: pathOf(el, section),
        elementPath: pathOf(el, section),
        label: (context ? context + " › " : "") + "圖片",
        src: el.getAttribute("src") || "",
        alt: el.getAttribute("alt") || "",
      });
      return;
    }
    const label = describe(el);
    const childEls = [...el.children];
    const hasBlockChild = childEls.some(
      (c) =>
        !INLINE_TAGS.has(c.tagName.toLowerCase()) &&
        !SKIP_TAGS.has(c.tagName.toLowerCase()),
    );
    if (tag === "a") {
      fields.push({
        kind: "link",
        path: pathOf(el, section),
        elementPath: pathOf(el, section),
        label: (context ? context + " › " : "") + label + "網址",
        href: el.getAttribute("href") || "",
      });
    }
    for (const node of el.childNodes) {
      if (node.nodeType === 3) {
        if (!node.nodeValue.trim()) continue;
        const m = node.nodeValue.match(/^(\s*)([\s\S]*?)(\s*)$/);
        fields.push({
          kind: "text",
          path: pathOf(node, section),
          elementPath: pathOf(el, section),
          label: (context ? context + " › " : "") + label,
          tag,
          value: collapse(m[2]),
          long:
            m[2].length > 60 ||
            ["p", "blockquote", "li", "dd"].includes(tag),
        });
      } else if (node.nodeType === 1) {
        const childTag = node.tagName.toLowerCase();
        walk(node, INLINE_TAGS.has(childTag) ? label : hasBlockChild ? "" : context);
      }
    }
  };
  walk(section, "");
  return fields;
}
export function setText(section, path, value) {
  const node = nodeAt(section, path);
  if (!node || node.nodeType !== 3) return false;
  const m = node.nodeValue.match(/^(\s*)([\s\S]*?)(\s*)$/);
  node.nodeValue = m[1] + value + m[3];
  return true;
}
export function setAttribute(section, path, name, value) {
  const el = nodeAt(section, path);
  if (!el || el.nodeType !== 1) return false;
  if (!["src", "alt", "href", "title"].includes(name)) return false;
  el.setAttribute(name, value);
  return true;
}

/* ---------------------------------------------------------------- page head */
export function readHead(doc) {
  const q = (sel) => doc.head.querySelector(sel);
  return {
    title: q("title")?.textContent || "",
    description: q('meta[name="description"]')?.getAttribute("content") || "",
  };
}
export function writeHead(doc, { title, description }) {
  const q = (sel) => doc.head.querySelector(sel);
  if (typeof title === "string") {
    const t = q("title");
    if (t) t.textContent = title;
    for (const sel of [
      'meta[property="og:title"]',
      'meta[name="twitter:title"]',
    ]) {
      const m = q(sel);
      if (m) m.setAttribute("content", title);
    }
  }
  if (typeof description === "string") {
    for (const sel of [
      'meta[name="description"]',
      'meta[property="og:description"]',
      'meta[name="twitter:description"]',
    ]) {
      const m = q(sel);
      if (m) m.setAttribute("content", description);
    }
  }
}

/* ------------------------------------------------------------ convenience */
// Applies a mutation to an HTML string and returns the new string.
export function editHtml(html, mutate) {
  const page = parsePage(html);
  const changed = mutate(page.doc, page);
  return changed === false ? html : serializePage(page);
}
