// 一次匯入多篇論文: reads what teachers already have — a BibTeX file
// (Zotero, Google Scholar), an RIS file (EndNote, Zotero, Mendeley), a list of
// DOIs / PMIDs, or an ORCID record — into the same metadata cite.js formats.
// Pure functions; the network calls (DOI, PubMed, ORCID) live in
// cloud/src/lookup.js.
import { parseIdentifier } from "./cite.js";

const collapse = (s) => String(s ?? "").replace(/\s+/g, " ").trim();

// Common LaTeX in BibTeX exports → plain text.
const ACCENTS = { '"': "̈", "'": "́", "`": "̀", "^": "̂", "~": "̃", "=": "̄", ".": "̇", u: "̆", v: "̌", H: "̋", c: "̧" };
function delatex(s) {
  return collapse(
    String(s ?? "")
      .replace(/\\([`'"^~=.]|[uvHc](?=[\s{]))\s*\{?\\?([A-Za-z])\}?/g, (_, a, ch) => (ch + (ACCENTS[a] || "")).normalize("NFC"))
      .replace(/\\(?:textit|textbf|emph|textrm|mathrm)\s*/g, "")
      .replace(/\\&/g, "&")
      .replace(/\\%/g, "%")
      .replace(/\\_/g, "_")
      .replace(/--/g, "-")
      .replace(/[{}]/g, ""),
  );
}

const CJK = /[㐀-鿿]/;
// "Sung, Chien-Mei" / "Chien-Mei Sung" / "宋建美" → { family, given } or { literal }.
export function splitName(raw) {
  const name = collapse(raw).replace(/\.$/, (m) => (/\b[A-Z]\.$/.test(raw) ? m : ""));
  if (!name) return null;
  if (CJK.test(name)) return { literal: name.replace(/\s+/g, "") };
  if (name.includes(",")) {
    const [family, ...rest] = name.split(",");
    return { family: collapse(family), given: collapse(rest.join(" ")) };
  }
  const words = name.split(" ");
  if (words.length === 1) return { literal: name };
  return { family: words[words.length - 1], given: words.slice(0, -1).join(" ") };
}

const blank = () => ({ authors: [], year: null, title: "", journal: "", volume: "", issue: "", pages: "", article: "", doi: "", pmid: "" });
const yearOf = (s) => Number(String(s ?? "").match(/\b(1[89]\d\d|20\d\d)\b/)?.[1]) || null;
const doiOf = (s) => parseIdentifier(String(s ?? "").trim())?.type === "doi" ? parseIdentifier(String(s).trim()).id : "";

/* ------------------------------------------------------------------ BibTeX */
// One value: {…} with nesting, "…", or a bare word/number.
function readValue(src, i) {
  while (/\s/.test(src[i])) i++;
  if (src[i] === "{") {
    let depth = 0;
    const start = i + 1;
    for (; i < src.length; i++) {
      if (src[i] === "{") depth++;
      else if (src[i] === "}" && --depth === 0) return { value: src.slice(start, i), end: i + 1 };
    }
    return { value: src.slice(start), end: src.length };
  }
  if (src[i] === '"') {
    let depth = 0;
    const start = i + 1;
    for (i++; i < src.length; i++) {
      if (src[i] === "{") depth++;
      else if (src[i] === "}") depth--;
      else if (src[i] === '"' && depth === 0) return { value: src.slice(start, i), end: i + 1 };
    }
    return { value: src.slice(start), end: src.length };
  }
  const m = src.slice(i).match(/^[^,}\s]+/);
  return { value: m ? m[0] : "", end: i + (m ? m[0].length : 0) };
}

export function parseBibtex(text) {
  const src = String(text || "");
  const out = [];
  const at = /@(\w+)\s*[{(]/g;
  let m;
  while ((m = at.exec(src))) {
    const type = m[1].toLowerCase();
    if (type === "comment" || type === "string" || type === "preamble") continue;
    let i = m.index + m[0].length;
    const key = src.slice(i).match(/^[^,]*,/);
    if (!key) continue;
    i += key[0].length;
    const f = {};
    for (;;) {
      const name = src.slice(i).match(/^\s*([A-Za-z][\w-]*)\s*=/);
      if (!name) break;
      i += name[0].length;
      const { value, end } = readValue(src, i);
      f[name[1].toLowerCase()] = value;
      i = end;
      // Values joined with # (rare) are kept as the first part.
      const rest = src.slice(i).match(/^\s*(#\s*(?:\{[^}]*\}|"[^"]*"|\w+)\s*)*,?/);
      i += rest ? rest[0].length : 0;
    }
    at.lastIndex = Math.max(at.lastIndex, i);
    const meta = blank();
    meta.authors = (f.author ? delatex(f.author.replace(/\s+and\s+/gi, "\u0000")).split("\u0000") : []).map(splitName).filter(Boolean);
    meta.title = delatex(f.title).replace(/[.]$/, "");
    meta.journal = delatex(f.journal || f.journaltitle || f.booktitle);
    meta.year = yearOf(f.year || f.date);
    meta.volume = delatex(f.volume);
    meta.issue = delatex(f.number || f.issue);
    meta.pages = delatex(f.pages).replace(/\s*[-–]+\s*/, "-");
    meta.article = delatex(f.eid || f.articleno);
    meta.doi = doiOf(delatex(f.doi)) || doiOf(delatex(f.url));
    meta.pmid = delatex(f.pmid);
    if (meta.title) out.push(meta);
  }
  return out;
}

/* --------------------------------------------------------------------- RIS */
export function parseRis(text) {
  const out = [];
  let cur = null;
  let f = null;
  const finish = () => {
    if (!cur) return;
    const get = (...tags) => tags.map((t) => f[t]?.[0]).find(Boolean) || "";
    cur.authors = ["AU", "A1"].flatMap((t) => f[t] || []).map(splitName).filter(Boolean);
    cur.title = collapse(get("TI", "T1", "CT")).replace(/[.]$/, "");
    cur.journal = collapse(get("T2", "JF", "JO", "JA", "J2", "BT"));
    cur.year = yearOf(get("PY", "Y1", "DA"));
    cur.volume = collapse(get("VL"));
    cur.issue = collapse(get("IS"));
    const sp = collapse(get("SP"));
    const ep = collapse(get("EP"));
    cur.pages = sp && ep && sp !== ep ? `${sp}-${ep}` : sp;
    cur.doi = doiOf(get("DO")) || doiOf(get("UR"));
    const an = collapse(get("AN"));
    if (/^\d{5,9}$/.test(an)) cur.pmid = an;
    if (cur.title) out.push(cur);
    cur = null;
  };
  for (const line of String(text || "").split(/\r?\n/)) {
    const m = line.match(/^([A-Z][A-Z0-9])  - ?(.*)$/);
    if (!m) continue;
    const [, tag, value] = m;
    if (tag === "TY") {
      finish();
      cur = blank();
      f = {};
      continue;
    }
    if (!cur) continue;
    if (tag === "ER") {
      finish();
      continue;
    }
    (f[tag] ||= []).push(value.trim());
  }
  finish();
  return out;
}

/* ----------------------------------------------------- what was pasted in */
// → { format: "bibtex" | "ris" | "ids" | null, items, ids }
export function readImport(text) {
  const s = String(text || "");
  if (/@\w+\s*[{(]/.test(s)) return { format: "bibtex", items: parseBibtex(s), ids: [] };
  if (/^TY  - /m.test(s)) return { format: "ris", items: parseRis(s), ids: [] };
  const ids = [];
  const seen = new Set();
  for (const raw of s.split(/[\n\r,;]+|\s{2,}/)) {
    const line = raw.trim();
    if (!line) continue;
    const doi = line.match(/10\.\d{4,9}\/\S+/);
    const id = parseIdentifier(doi ? doi[0] : line);
    if (!id) continue;
    const key = id.type + ":" + id.id.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    ids.push(id);
  }
  return { format: ids.length ? "ids" : null, items: [], ids };
}

/* ----------------------------------------------------------------- ORCID */
// "https://orcid.org/0000-0002-1825-0097" → "0000-0002-1825-0097" when the
// check digit (ISO 7064 11,2) is right, else null.
export function parseOrcid(input) {
  const m = String(input || "").toUpperCase().match(/(\d{4})-?(\d{4})-?(\d{4})-?(\d{3}[\dX])/);
  if (!m) return null;
  const digits = m.slice(1).join("");
  let total = 0;
  for (const ch of digits.slice(0, 15)) total = (total + Number(ch)) * 2;
  const check = (12 - (total % 11)) % 11;
  if ((check === 10 ? "X" : String(check)) !== digits[15]) return null;
  return m.slice(1).join("-");
}

// ORCID /works summary (pub.orcid.org v3.0) → [{ title, year, journal, doi, pmid, type }]
export function orcidWorks(data) {
  const out = [];
  for (const group of data?.group || []) {
    const w = group["work-summary"]?.[0];
    if (!w) continue;
    const ids = [...(group["external-ids"]?.["external-id"] || []), ...(w["external-ids"]?.["external-id"] || [])];
    const idOf = (type) => ids.find((x) => x["external-id-type"] === type)?.["external-id-value"] || "";
    out.push({
      title: collapse(w.title?.title?.value),
      year: Number(w["publication-date"]?.year?.value) || null,
      journal: collapse(w["journal-title"]?.value),
      doi: doiOf(idOf("doi")),
      pmid: idOf("pmid").replace(/\D/g, ""),
      type: w.type || "",
    });
  }
  return out.filter((w) => w.title);
}

/* ------------------------------------------------- already on the site? */
const squash = (t) =>
  String(t || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}]+/gu, "");
const titleKey = (t) => squash(t).slice(0, 60);

// The text of the publication pages → a lookup for papers already listed.
export function siteIndex(texts) {
  const all = texts.join("\n");
  return {
    dois: new Set((all.match(/10\.\d{4,9}\/[^\s"<>]+/gi) || []).map((d) => d.replace(/[.,;)\]]+$/, "").toLowerCase())),
    flat: squash(all.replace(/<[^>]+>/g, " ")),
  };
}

export function isListed(meta, index) {
  if (meta.doi && index.dois.has(meta.doi.toLowerCase())) return true;
  const key = titleKey(meta.title);
  return key.length >= 20 && index.flat.includes(key);
}

// Newest first, then by title, the order a publication list reads in.
export const newestFirst = (list) => [...list].sort((a, b) => (b.year || 0) - (a.year || 0) || String(a.title).localeCompare(String(b.title)));
