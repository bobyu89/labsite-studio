// Site navigation and page management for the two navigation styles LabSite
// sites use:
//
//   components  js/components.js   const NAV_ITEMS = [ { key, label, labelEn, href, children? } ]
//               (the two hand-made lab sites; one level of drop-down groups;
//                the page knows itself through initLayout('key'[, 'en']))
//   data        js/data.js         const NAV = [ { page, zone?, zh, en } ]
//               (templates; flat; the page knows itself through <body data-page>)
//
// The array literal is parsed without evaluating the file (a small JS subset:
// objects, arrays, strings, numbers, true/false/null), edited as data and
// written back in the same layout, so saving an unchanged menu changes nothing
// and saving a changed one touches only the lines that changed.
//
// Every function here is pure; the editor (useProject) reads and writes files.

import { parsePage, serializePage, sectionElements, removeSection, collectFields, setText, writeHead, insertSection, nodeAt } from "./page.js";
import { resolveFrom } from "./source.js";
import { ensureBlockAssets, adoptHeading } from "./albums.js";

export const NAV_FILES = [
  { path: "js/components.js", name: "NAV_ITEMS", style: "components" },
  { path: "js/data.js", name: "NAV", style: "data" },
];

/* --------------------------------------------------------------- tokens */
function tokenize(text, from, to) {
  const tokens = [];
  let i = from;
  while (i < to) {
    const ch = text[i];
    if (/\s/.test(ch)) {
      i++;
      continue;
    }
    if (ch === "/" && text[i + 1] === "/") return { error: "選單裡有註解" };
    if (ch === "/" && text[i + 1] === "*") return { error: "選單裡有註解" };
    if ("{}[],:".includes(ch)) {
      tokens.push({ t: ch });
      i++;
      continue;
    }
    if (ch === '"' || ch === "'") {
      let j = i + 1;
      let value = "";
      while (j < to && text[j] !== ch) {
        if (text[j] === "\\") {
          const n = text[j + 1];
          value += { n: "\n", t: "\t", r: "\r", "\\": "\\", '"': '"', "'": "'" }[n] ?? n;
          j += 2;
        } else value += text[j++];
      }
      if (j >= to) return { error: "字串沒有結束" };
      tokens.push({ t: "str", v: value, q: ch });
      i = j + 1;
      continue;
    }
    const word = text.slice(i, to).match(/^[A-Za-z_$][\w$]*|^-?\d+(?:\.\d+)?/);
    if (!word) return { error: "看不懂的寫法：" + text.slice(i, i + 12) };
    const w = word[0];
    tokens.push(
      /^-?\d/.test(w)
        ? { t: "num", v: Number(w) }
        : w === "true" || w === "false"
          ? { t: "lit", v: w === "true" }
          : w === "null"
            ? { t: "lit", v: null }
            : { t: "id", v: w },
    );
    i += w.length;
  }
  return { tokens };
}
function parseTokens(tokens) {
  let k = 0;
  const peek = () => tokens[k];
  const take = (t) => {
    const tok = tokens[k++];
    if (!tok || (t && tok.t !== t)) throw new Error("格式不符");
    return tok;
  };
  const value = () => {
    const tok = peek();
    if (!tok) throw new Error("格式不符");
    if (tok.t === "[") {
      take("[");
      const out = [];
      while (peek() && peek().t !== "]") {
        out.push(value());
        if (peek()?.t === ",") take(",");
        else break;
      }
      take("]");
      return out;
    }
    if (tok.t === "{") {
      take("{");
      const out = {};
      while (peek() && peek().t !== "}") {
        const key = take();
        if (key.t !== "id" && key.t !== "str") throw new Error("格式不符");
        take(":");
        out[key.v] = value();
        if (peek()?.t === ",") take(",");
        else break;
      }
      take("}");
      return out;
    }
    k++;
    if (tok.t === "str" || tok.t === "num" || tok.t === "lit") return tok.v;
    throw new Error("格式不符");
  };
  const v = value();
  if (k !== tokens.length) throw new Error("格式不符");
  return v;
}

/* ---------------------------------------------------------- locate / read */
// Finds `const NAME = [ … ];` and returns the array literal's range.
function arrayRange(text, name) {
  const m = new RegExp("(?:const|let|var)\\s+" + name + "\\s*=\\s*\\[").exec(text);
  if (!m) return null;
  const start = m.index + m[0].length - 1;
  let depth = 0;
  let quote = null;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (quote) {
      if (ch === "\\") i++;
      else if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'") quote = ch;
    else if (ch === "[") depth++;
    else if (ch === "]" && --depth === 0) return { start, end: i + 1 };
  }
  return null;
}

// Layout facts copied from the original so writing back keeps its style.
function layoutOf(literal) {
  const indent = (literal.match(/\[\s*?\n([ \t]+)\S/) || [, "  "])[1];
  const trailing = /,\s*\]$/.test(literal);
  const inner = literal.match(/\[\s*?\n[ \t]+\{[^\n]*\[\s*?\n[\s\S]*?(,?)\s*\n\s*\]/);
  return { indent, trailing, childTrailing: inner ? inner[1] === "," : trailing };
}

export function readNav(text, spec) {
  const range = arrayRange(text, spec.name);
  if (!range) return null;
  const literal = text.slice(range.start, range.end);
  const lex = tokenize(text, range.start, range.end);
  const eol = literal.includes("\r\n") ? "\r\n" : "\n";
  const base = { ...spec, range, eol, layout: layoutOf(literal.replace(/\r\n/g, "\n")) };
  if (lex.error) return { ...base, ok: false, error: lex.error, raw: [] };
  try {
    const raw = parseTokens(lex.tokens);
    if (!Array.isArray(raw) || !raw.every((x) => x && typeof x === "object" && !Array.isArray(x)))
      throw new Error("格式不符");
    const quotes = lex.tokens.some((t) => t.t === "str" && t.q === "'") ? "'" : '"';
    return { ...base, ok: true, raw, quotes };
  } catch (e) {
    return { ...base, ok: false, error: "選單的寫法無法自動編輯（" + e.message + "）", raw: [] };
  }
}

/* ------------------------------------------------------------- write */
const IDENT = /^[A-Za-z_$][\w$]*$/;
function str(v, q) {
  const body = String(v)
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r")
    .replace(/\t/g, "\\t");
  return q + body.replace(new RegExp(q, "g"), "\\" + q) + q;
}
function serialize(value, indent, layout, q, depth = 0) {
  if (Array.isArray(value)) {
    const inner = indent + (depth ? "  " : "");
    const close = depth ? indent : "";
    if (!value.length) return "[]";
    const trailing = depth ? layout.childTrailing : layout.trailing;
    return (
      "[\n" +
      value.map((v) => inner + serialize(v, inner, layout, q, depth + 1)).join(",\n") +
      (trailing ? "," : "") +
      "\n" +
      close +
      "]"
    );
  }
  if (value && typeof value === "object") {
    const parts = Object.entries(value).map(
      ([k, v]) => (IDENT.test(k) ? k : str(k, q)) + ": " + serialize(v, indent, layout, q, depth),
    );
    return parts.length ? "{ " + parts.join(", ") + " }" : "{}";
  }
  if (typeof value === "string") return str(value, q);
  return String(value);
}
export function writeNav(text, nav, raw) {
  const literal = serialize(raw, nav.layout.indent, nav.layout, nav.quotes || '"');
  const out = nav.eol === "\r\n" ? literal.replace(/\n/g, "\r\n") : literal;
  return text.slice(0, nav.range.start) + out + text.slice(nav.range.end);
}

/* ------------------------------------------------------- unified model */
// One shape for both styles: { id, zh, en, page, href, children }.
//   page: the site path the item opens ("members.html"), or null for groups
//         and links that are not a plain page (anchors, other sites).
export function navItems(nav) {
  if (!nav?.ok) return [];
  const one = (x) => {
    if (nav.style === "data") {
      const page = typeof x.page === "string" ? x.page + ".html" : null;
      return { id: x.page ?? "", zh: x.zh ?? "", en: x.en ?? "", page, href: page, children: null };
    }
    const href = typeof x.href === "string" ? x.href : null;
    const page = href && /^[\w.-]+\.html$/.test(href) ? href : null;
    return {
      id: x.key ?? "",
      zh: x.label ?? "",
      en: x.labelEn ?? "",
      page,
      href,
      children: Array.isArray(x.children) ? x.children.map(one) : null,
    };
  };
  return nav.raw.map(one);
}
export const supportsGroups = (nav) => nav?.style === "components";

// Pages the menu opens, flattened: [{ page, zh, en, group }].
export function navPages(nav) {
  const out = [];
  for (const item of navItems(nav)) {
    if (item.page) out.push({ page: item.page, zh: item.zh, en: item.en, group: null });
    for (const c of item.children || []) if (c.page) out.push({ page: c.page, zh: c.zh, en: c.en, group: item.zh });
  }
  return out;
}

const LABEL_KEYS = { components: ["label", "labelEn"], data: ["zh", "en"] };
// A new leaf with the same key order as the site's existing leaves.
function makeLeaf(nav, { id, zh, en }) {
  const sample = nav.raw.find((x) => !x.children) || {};
  const values =
    nav.style === "data"
      ? { page: id, zh, en }
      : { key: id, label: zh, labelEn: en, href: id + ".html" };
  const out = {};
  for (const k of Object.keys(sample)) if (k in values) out[k] = values[k];
  for (const [k, v] of Object.entries(values)) if (!(k in out)) out[k] = v;
  return out;
}
function makeGroup({ id, zh, en }) {
  return { key: id, label: zh, labelEn: en, children: [] };
}

// Paths into raw: [i] for a top-level item, [i, j] for a child.
const clone = (raw) => JSON.parse(JSON.stringify(raw));
const listAt = (raw, path) => (path.length === 1 ? raw : raw[path[0]].children);
export function navRename(nav, path, { zh, en }) {
  const raw = clone(nav.raw);
  const item = path.length === 1 ? raw[path[0]] : raw[path[0]].children[path[1]];
  const [kz, ke] = LABEL_KEYS[nav.style];
  if (typeof zh === "string") item[kz] = zh;
  if (typeof en === "string") item[ke] = en;
  return raw;
}
export function navRemove(nav, path) {
  const raw = clone(nav.raw);
  listAt(raw, path).splice(path.at(-1), 1);
  return raw;
}
// Moves an item to another place: `to` is { parent: null | topIndex, index }.
export function navMove(nav, path, to) {
  const raw = clone(nav.raw);
  const from = listAt(raw, path);
  const [item] = from.splice(path.at(-1), 1);
  if (to.parent !== null && item.children) throw new Error("下拉選單不能放進另一個下拉選單");
  // A group above the removed top-level item shifts up by one.
  let parent = to.parent;
  if (parent !== null && path.length === 1 && path[0] < parent) parent--;
  const target = parent === null ? raw : raw[parent]?.children;
  if (!target) throw new Error("找不到要放入的下拉選單");
  target.splice(Math.max(0, Math.min(to.index, target.length)), 0, item);
  return raw;
}
export function navAddPage(nav, { id, zh, en }, parent = null, index = null) {
  const raw = clone(nav.raw);
  const target = parent === null ? raw : raw[parent].children;
  target.splice(index ?? target.length, 0, makeLeaf(nav, { id, zh, en }));
  return raw;
}
export function navAddGroup(nav, { id, zh, en }, index = null) {
  if (!supportsGroups(nav)) throw new Error("這個網站的選單沒有下拉群組");
  const raw = clone(nav.raw);
  raw.splice(index ?? raw.length, 0, makeGroup({ id, zh, en }));
  return raw;
}
// Removes every item that opens `page`, and groups left empty by that.
export function navDropPage(nav, page) {
  const items = navItems(nav);
  const raw = clone(nav.raw);
  for (let i = raw.length - 1; i >= 0; i--) {
    if (items[i].page === page) {
      raw.splice(i, 1);
      continue;
    }
    if (raw[i].children) {
      const before = raw[i].children.length;
      raw[i].children = raw[i].children.filter((_, j) => items[i].children[j].page !== page);
      if (before && !raw[i].children.length) raw.splice(i, 1);
    }
  }
  return raw;
}
export function navRelabelPage(nav, page, { zh, en }) {
  const items = navItems(nav);
  let raw = clone(nav.raw);
  const [kz, ke] = LABEL_KEYS[nav.style];
  items.forEach((item, i) => {
    const set = (x) => {
      if (typeof zh === "string") x[kz] = zh;
      if (typeof en === "string") x[ke] = en;
    };
    if (item.page === page) set(raw[i]);
    (item.children || []).forEach((c, j) => c.page === page && set(raw[i].children[j]));
  });
  return raw;
}

/* --------------------------------------------------------------- pages */
// A file name from the English (or any) name: "Open Day" → "open-day".
export function slugFor(name, taken = []) {
  let base = String(name || "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/, "");
  if (!base) base = "page";
  const used = new Set(taken.map((t) => String(t).replace(/^en\//, "").replace(/\.html$/, "")));
  let slug = base;
  for (let n = 2; used.has(slug); n++) slug = base + "-" + n;
  return slug;
}

const PAGE_KEY = (page) => page.replace(/^en\//, "").replace(/\.html$/, "");
const HERO = /(^|\s)(hero|page-hero|page-sign)(\s|$)|hero/;
function heroOf(doc) {
  const first = sectionElements(doc)[0];
  return first && HERO.test(first.getAttribute("class") || "") ? first : null;
}
const isLatin = (s) => /^[\x20-\x7e]+$/.test(s.trim()) && /[A-Za-z]/.test(s);
const isUpper = (s) => s === s.toUpperCase() && /[A-Z]/.test(s);

// Rewrites references to one page file (identity script, data-page,
// canonical / og:url / alternates) in a page's text.
function retargetIdentity(html, fromKey, toKey) {
  return html
    .replace(new RegExp("(initLayout\\(\\s*['\"])" + escapeRe(fromKey) + "(['\"])", "g"), "$1" + toKey + "$2")
    .replace(new RegExp("(<body[^>]*\\sdata-page=[\"'])" + escapeRe(fromKey) + "([\"'])"), "$1" + toKey + "$2");
}
const escapeRe = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// The new page made from a base page: same head, header, footer and scripts;
// its own title, address and banner; either the base's content or, with
// blank, only the banner plus one 標題與文字 block (blockHtml).
export function makePage(baseHtml, { basePath, newPath, name, otherName, lang, siteLabel, blank, blockHtml, placeholder }) {
  const fromKey = PAGE_KEY(basePath);
  const toKey = PAGE_KEY(newPath);
  const page = parsePage(retargetIdentity(baseHtml, fromKey, toKey));
  const { doc } = page;
  // Title: "<old page name>｜Lab" → "<new name>｜Lab"; otherwise new name first.
  const oldTitle = doc.head.querySelector("title")?.textContent || "";
  const title = siteLabel && oldTitle.includes(siteLabel) ? oldTitle.replace(siteLabel, name) : name + (oldTitle ? "｜" + oldTitle : "");
  writeHead(doc, { title, description: placeholder.description });
  const baseFile = basePath.split("/").pop();
  const newFile = newPath.split("/").pop();
  for (const el of doc.head.querySelectorAll('link[rel="canonical"], link[rel="alternate"], meta[property="og:url"]')) {
    const attr = el.tagName.toLowerCase() === "meta" ? "content" : "href";
    const v = el.getAttribute(attr) || "";
    if (v.endsWith("/" + baseFile) || v === baseFile) el.setAttribute(attr, v.slice(0, v.length - baseFile.length) + newFile);
  }
  const hero = heroOf(doc);
  if (blank) {
    // Insert first (so the block gets the page's own divider), then drop the
    // base page's content after it.
    // The block wears the site's own heading style (copied from the base
    // page's content before it goes) and brings its stylesheet and script.
    const keep = hero ? 2 : 1;
    insertSection(doc, hero ? 0 : -1, blockHtml, newPath);
    adoptHeading(doc, sectionElements(doc)[keep - 1], { kicker: "" });
    while (sectionElements(doc).length > keep) removeSection(doc, keep);
    ensureBlockAssets(doc, newPath);
  }
  if (hero) {
    let h1Done = false;
    // Banner: the heading takes the page's name; a short line in the other
    // script (an English kicker, a 中文 subtitle, or anything marked with
    // lang) takes the name in that language; longer text becomes a prompt.
    const enName = lang === "en" ? name : otherName;
    const zhName = lang === "en" ? otherName : name;
    const cased = (was, v) => (isUpper(was) ? v.toUpperCase() : v);
    for (const f of collectFields(hero)) {
      if (f.kind !== "text") continue;
      const own = nodeAt(hero, f.elementPath)?.getAttribute?.("lang") || "";
      const short = f.value.length <= 40;
      if (f.tag === "h1" && !h1Done) {
        setText(hero, f.path, name);
        h1Done = true;
      } else if (f.tag === "h1") setText(hero, f.path, "");
      else if (short && /^en/i.test(own)) setText(hero, f.path, cased(f.value, enName));
      else if (short && /^zh/i.test(own)) setText(hero, f.path, zhName);
      else if (short && isLatin(f.value) && (f.tag !== "p" || lang === "zh")) setText(hero, f.path, cased(f.value, enName));
      else setText(hero, f.path, placeholder.lede);
    }
  }
  return serializePage(page);
}

// Display-name change: title, social titles and the banner heading follow
// the menu label when they used the old name.
export function renamePage(html, { oldName, name }) {
  if (!oldName || oldName === name) return html;
  const page = parsePage(html);
  const { doc } = page;
  const t = doc.head.querySelector("title")?.textContent || "";
  if (t.includes(oldName)) writeHead(doc, { title: t.replace(oldName, name) });
  const hero = heroOf(doc);
  if (hero)
    for (const f of collectFields(hero))
      if (f.kind === "text" && f.tag === "h1" && f.value === oldName) setText(hero, f.path, name);
  return serializePage(page);
}

/* ------------------------------------------------------------ sitemap */
const URL_BLOCK = /([ \t]*)<url>[\s\S]*?<\/url>(\r?\n)?/g;
// Adds entries for a new page by copying the base page's entries.
export function sitemapAdd(xml, basePath, newPath, today) {
  if (!xml || xml.includes("/" + newPath + "</loc>")) return xml;
  const baseFile = basePath.replace(/^en\//, "");
  const newFile = newPath.replace(/^en\//, "");
  const blocks = [...xml.matchAll(URL_BLOCK)].filter((m) => new RegExp("/(en/)?" + escapeRe(baseFile) + "</loc>").test(m[0]));
  if (!blocks.length) return xml;
  const copy = blocks
    .map((m) =>
      m[0]
        .replace(new RegExp("/" + escapeRe(baseFile) + "(?=[\"<])", "g"), "/" + newFile)
        .replace(/<lastmod>[^<]*<\/lastmod>/, "<lastmod>" + today + "</lastmod>"),
    )
    .join("");
  const close = xml.lastIndexOf("</urlset>");
  if (close < 0) return xml;
  const eol = xml.includes("\r\n") ? "\r\n" : "\n";
  const lineStart = xml.lastIndexOf("\n", close) + 1;
  const body = copy.endsWith("\n") ? copy : copy + eol;
  return xml.slice(0, lineStart) + body + xml.slice(lineStart);
}
export function sitemapRemove(xml, path) {
  if (!xml) return xml;
  const file = path.replace(/^en\//, "");
  return xml.replace(URL_BLOCK, (block) => (new RegExp("/(en/)?" + escapeRe(file) + "</loc>").test(block) ? "" : block));
}

/* ------------------------------------------------------- inbound links */
// Pages that link to `target` (site path). texts: { path: html }.
export function linksTo(texts, target) {
  const out = [];
  for (const [path, html] of Object.entries(texts)) {
    if (path === target || !html || !/\.html$/.test(path)) continue;
    const refs = [...html.matchAll(/\shref\s*=\s*["']([^"'#?]+)/g)].map((m) => m[1]);
    if (refs.some((r) => resolveFrom(path, r) === target)) out.push(path);
  }
  return out;
}
