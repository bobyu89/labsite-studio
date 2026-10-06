// A site's section library: reusable <section> snippets that live inside the
// site itself, so they always match its CSS and travel with it (cloud,
// GitHub, folder). Layout:
//   labsite/library.json          manifest (below)
//   labsite/sections/<id>.html    one <section>, written as if at the site root
//   labsite/sections/<id>.en.html optional English version
//
//   { "version": 1, "template": "basic",
//     "sections": [{ "id": "hero-split", "name": "主視覺（左文右圖）",
//                    "category": "主視覺", "description": "…" }] }
import { normalizePath } from "./source.js";
import { editHtml, sectionElements, insertSection, snippetParts, rebaseRefs } from "./page.js";

export const LIBRARY_PATH = "labsite/library.json";
const ID = /^[a-z0-9][a-z0-9-]{0,47}$/;

export const snippetPath = (id, lang = "zh") => `labsite/sections/${id}${lang === "en" ? ".en" : ""}.html`;

// Validates a manifest. Returns { ok, library, error }; unknown fields are
// ignored, bad entries are dropped so one typo does not hide the whole library.
export function parseLibrary(text) {
  let raw;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: "元件庫設定檔不是正確的 JSON。" };
  }
  if (!raw || typeof raw !== "object" || raw.version !== 1 || !Array.isArray(raw.sections))
    return { ok: false, error: "元件庫設定檔格式不正確（需要 version: 1 與 sections）。" };
  const seen = new Set();
  const sections = [];
  for (const s of raw.sections) {
    if (!s || typeof s !== "object" || !ID.test(String(s.id)) || seen.has(s.id)) continue;
    let file, en;
    try {
      file = normalizePath(s.file || snippetPath(s.id));
      en = s.en === false ? null : normalizePath(s.en || snippetPath(s.id, "en"));
    } catch {
      continue; // a path outside the site
    }
    seen.add(s.id);
    sections.push({
      id: s.id,
      name: String(s.name || s.id).slice(0, 40),
      category: String(s.category || "其他").slice(0, 20),
      description: String(s.description || "").slice(0, 160),
      file,
      en,
    });
  }
  return { ok: true, library: { template: typeof raw.template === "string" ? raw.template : null, sections } };
}

// Reads the library of a site source; null when the site has none.
export async function loadLibrary(source) {
  let text;
  try {
    text = await source.readText(LIBRARY_PATH);
  } catch {
    return null;
  }
  const parsed = parseLibrary(text);
  return parsed.ok ? parsed.library : { template: null, sections: [], error: parsed.error };
}

// A page showing only one snippet, with the page's own head, header, footer
// and scripts around it — what the picker previews before inserting.
export function snippetPreviewHtml(pageHtml, snippetHtml, pagePath = "") {
  return editHtml(pageHtml, (doc) => {
    const sections = sectionElements(doc);
    if (!sections.length) return insertSection(doc, -1, snippetHtml, pagePath);
    const parts = snippetParts(doc, snippetHtml);
    if (!parts) return false;
    rebaseRefs(parts.section, pagePath);
    // Take the first section's place, so header and footer stay around it.
    sections[0].replaceWith(parts.section);
    for (const s of sections.slice(1)) s.remove();
    for (const d of [...doc.body.children]) if (/divider/.test(d.getAttribute("class") || "")) d.remove();
    return true;
  });
}

// Category order for the picker: as first seen in the manifest.
export function groupByCategory(sections) {
  const groups = new Map();
  for (const s of sections) {
    if (!groups.has(s.category)) groups.set(s.category, []);
    groups.get(s.category).push(s);
  }
  return [...groups].map(([category, items]) => ({ category, items }));
}
