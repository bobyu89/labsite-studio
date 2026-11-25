// DOI / PubMed lookup → a reference in the lab's usual style (APA 7 for
// English, 中文 APA for Chinese). Metadata comes from doi.org content
// negotiation (DOIs of every registration agency, Crossref and 華藝 alike) or
// NCBI E-utilities (PMID); the network calls live in cloud/src/lookup.js.

const DOI = /\b(10\.\d{4,9}\/[^\s"<>]+?)[.,;)]*$/i;
const CJK = /[㐀-鿿]/;

// "https://doi.org/10.1/x", "doi: 10.1/x", "PMID: 39889522",
// "https://pubmed.ncbi.nlm.nih.gov/39889522/" → { type, id } or null.
export function parseIdentifier(input) {
  const s = String(input || "").trim();
  if (!s) return null;
  const pubmed = s.match(/pubmed\.ncbi\.nlm\.nih\.gov\/(\d{1,9})/i) || s.match(/^(?:pmid\s*:?\s*)?(\d{4,9})$/i);
  if (pubmed) return { type: "pmid", id: pubmed[1] };
  const doi = s.replace(/^doi\s*:?\s*/i, "").replace(/^https?:\/\/(dx\.)?doi\.org\//i, "").match(DOI);
  if (doi) return { type: "doi", id: decodeURIComponent(doi[1]) };
  return null;
}

const clean = (s) =>
  String(s ?? "")
    .replace(/<[^>]+>/g, "")
    .replace(/[\u2010\u2011]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
const first = (v) => (Array.isArray(v) ? v[0] : v);
const year = (parts) => {
  const y = Number(Array.isArray(parts?.["date-parts"]?.[0]) ? parts["date-parts"][0][0] : NaN);
  return Number.isFinite(y) && y > 0 ? y : null;
};

// CSL-JSON (doi.org content negotiation, any registration agency) or a
// Crossref /works message → metadata.
export function fromCsl(m = {}) {
  return {
    authors: (m.author || [])
      .filter((a) => a.family || a.literal || a.name)
      .map((a) => (a.family ? { family: clean(a.family), given: clean(a.given) } : { literal: clean(a.literal || a.name) })),
    year: year(m.issued) || year(m["published-print"]) || year(m["published-online"]),
    title: clean(first(m.title)),
    journal: clean(first(m["container-title"])),
    volume: clean(m.volume),
    issue: clean(m.issue),
    pages: clean(m.page || m["page-first"]),
    article: clean(m["article-number"]),
    doi: clean(m.DOI),
    pmid: "",
  };
}

// "Journal of clinical neuroscience : official journal of …" → "Journal of Clinical Neuroscience"
const SMALL = new Set(["a", "an", "and", "as", "at", "but", "by", "for", "in", "of", "on", "or", "the", "to", "with", "&"]);
function journalName(name) {
  const base = clean(name).split(/\s+:\s+|\s+=\s+/)[0].replace(/\.$/, "");
  // NLM writes journal names in sentence case ("Journal of clinical neuroscience").
  const words = base.split(" ");
  if (CJK.test(base) || words.slice(1).some((w) => w !== w.toLowerCase())) return base;
  return words
    .map((w, i) => (i > 0 && SMALL.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(" ");
}

// NCBI esummary result (one uid) → metadata. PubMed names come as "Sung CM".
export function fromPubmed(doc, pmid) {
  const d = doc || {};
  const doi = (d.articleids || []).find((a) => a.idtype === "doi")?.value || "";
  return {
    authors: (d.authors || [])
      .filter((a) => a.authtype === "Author" && a.name)
      .map((a) => {
        const m = clean(a.name).match(/^(.*\S)\s+([A-Z]{1,4})$/);
        return m ? { family: m[1], given: m[2].split("").join(" ") } : { literal: clean(a.name) };
      }),
    year: Number(String(d.pubdate || d.epubdate || "").match(/\d{4}/)?.[0]) || null,
    title: clean(d.title).replace(/\.$/, ""),
    journal: journalName(d.fulljournalname || d.source),
    volume: clean(d.volume),
    issue: clean(d.issue),
    pages: clean(d.pages),
    article: "",
    doi,
    pmid: String(pmid || d.uid || ""),
  };
}

// "Chien-Mei" → "C.-M." (hyphen: true) or "C. M."; "X. M." stays; "Wei" → "W."
function initials(given, hyphen) {
  const g = clean(given);
  if (!g) return "";
  return g
    .split(/\s+/)
    .map((word) =>
      word
        .split("-")
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + ".")
        .join(hyphen ? "-" : " "),
    )
    .join(" ");
}

const isZh = (meta) => meta.authors.length > 0 && meta.authors.every((a) => CJK.test(a.family || a.literal || ""));

// metadata → { text, journal, url } for the 新增論文 form.
// opts.hyphen: write hyphenated given names as "C.-M." (otherwise "C. M.").
export function formatReference(meta, opts = {}) {
  const url = meta.doi ? "https://doi.org/" + meta.doi : meta.pmid ? `https://pubmed.ncbi.nlm.nih.gov/${meta.pmid}/` : "";
  const pages = meta.pages && meta.pages !== meta.article ? meta.pages.replace(/\s*[-–]\s*/, "-") : "";
  if (isZh(meta)) {
    const names = meta.authors.map((a) => a.literal || a.family + a.given).join("、");
    const where = [meta.journal, meta.volume ? meta.volume + (meta.issue ? `(${meta.issue})` : "") : "", pages || meta.article].filter(Boolean).join("，");
    return { text: `${names}（${meta.year || "無日期"}）．${meta.title.replace(/[。．.]$/, "")}．${where}。`, journal: meta.journal, url };
  }
  const name = (a) => a.literal || [a.family, initials(a.given, opts.hyphen)].filter(Boolean).join(", ");
  const list = meta.authors.map(name);
  let authors;
  if (list.length > 20) authors = list.slice(0, 19).join(", ") + ", . . . " + list[list.length - 1];
  else if (list.length > 1) authors = list.slice(0, -1).join(", ") + ", & " + list[list.length - 1];
  else authors = list[0] || "";
  const title = meta.title.replace(/[.?!]$/, (m) => (m === "." ? "" : m));
  const end = /[?!]$/.test(title) ? "" : ".";
  const volume = meta.volume ? `, ${meta.volume}${meta.issue ? `(${meta.issue})` : ""}` : "";
  const locator = pages ? `, ${pages}` : meta.article ? `, Article ${meta.article}` : "";
  const text = `${authors}${authors && !authors.endsWith(".") ? "." : ""} (${meta.year || "n.d."}). ${title}${end} ${meta.journal}${volume}${locator}.`.replace(/\s+/g, " ").trim();
  return { text, journal: meta.journal, url };
}

// The same metadata for template lists that keep each part in its own
// element (年份／標題／作者／期刊…, see quickAdd.js) → one value per field.
export function fieldValuesFor(fields, meta, opts = {}) {
  const zh = isZh(meta);
  const name = (a) => a.literal || (zh ? a.family + a.given : [a.family, initials(a.given, opts.hyphen)].filter(Boolean).join(", "));
  const authors = meta.authors.map(name).join(zh ? "、" : ", ");
  const where = [meta.journal, meta.volume ? meta.volume + (meta.issue ? `(${meta.issue})` : "") : "", meta.pages || (meta.article ? "Article " + meta.article : "")]
    .filter(Boolean)
    .join(", ");
  const url = meta.doi ? "https://doi.org/" + meta.doi : meta.pmid ? `https://pubmed.ncbi.nlm.nih.gov/${meta.pmid}/` : "";
  return fields.map((f) => {
    if (f.kind === "link") return url;
    const label = f.label || "";
    if (/年份|日期/.test(label)) return meta.year ? String(meta.year) : "";
    if (/標題|題目|title/i.test(label)) return meta.title;
    if (/作者|author/i.test(label)) return authors;
    if (/期刊|出處|venue|journal|source/i.test(label)) return where;
    return "";
  });
}
