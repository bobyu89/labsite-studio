// 建立網站精靈: turns a teacher's answers (and the AI's drafts) into a new
// site from a template, as plain text work shared by the server (when the
// site is created) and the browser (the live preview while choosing).
//   slots: labsite/template.json "slots" — [{ key, zh, en }]: each is the
//          exact sample wording of one element on the Chinese / English pages.
import { patchSiteField, readSiteFields } from "./siteData.js";
import { patchTheme } from "./themes.js";

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const isPage = (path) => /\.html?$/i.test(path);
const isEn = (path) => path.startsWith("en/");

// files: Map(path → text). fill: { key: { zh, en } }. Only whole elements
// whose text is exactly the sample change, so a short tag like 心衰竭 inside
// a longer sentence elsewhere is left alone.
export function fillSlots(files, slots, fill) {
  const out = new Map(files);
  for (const [path, text] of files) {
    if (!isPage(path)) continue;
    const lang = isEn(path) ? "en" : "zh";
    let next = text;
    for (const s of slots || []) {
      const value = String(fill?.[s.key]?.[lang] ?? "").trim();
      if (!value || !s[lang]) continue;
      next = next.split(">" + esc(s[lang]) + "<").join(">" + esc(value) + "<");
    }
    if (next !== text) out.set(path, next);
  }
  return out;
}

// Pages the lab does not want (research / publications): the files go, and
// so do their entries in NAV (js/data.js), their bands on other pages and
// their lines in sitemap.xml.
export function dropPages(files, pages) {
  const out = new Map(files);
  for (const page of pages || []) {
    const name = page.replace(/\.html?$/i, "");
    out.delete(page);
    out.delete("en/" + page);
    for (const [path, text] of out) {
      let next = text;
      if (path === "js/data.js") next = next.replace(new RegExp(`^[ \\t]*\\{\\s*page:\\s*"${name}"[^\\n]*\\n`, "m"), "");
      else if (isPage(path))
        next = next
          .replace(new RegExp(`[ \\t]*<li class="zone-band"[^>]*>\\s*<a class="zone-band__link" href="(?:\\.\\./)?${name}\\.html">[\\s\\S]*?</li>\\n?`, "g"), "")
          // Plain buttons and links to it (e.g. 主持人 › 看論文) go too.
          .replace(new RegExp(`[ \\t]*<a\\b[^>]*href="(?:\\.\\./)?${name}\\.html(?:#[^"]*)?"[^>]*>[^<]*</a>\\n?`, "g"), "");
      else if (path === "sitemap.xml") next = next.replace(new RegExp(`\\s*<url>\\s*<loc>[^<]*/${name}\\.html</loc>[\\s\\S]*?</url>`, "g"), "");
      if (next !== text) out.set(path, next);
    }
  }
  return out;
}

// SITE fields in js/data.js (研究室資料) the teacher filled in.
export function fillSiteFields(files, fields) {
  const out = new Map(files);
  let data = out.get("js/data.js");
  if (data === undefined) return out;
  const known = new Set(readSiteFields(data).fields.map((f) => f.key));
  for (const [key, value] of Object.entries(fields || {})) {
    const v = String(value ?? "").trim();
    if (v && known.has(key)) data = patchSiteField(data, key, v);
  }
  out.set("js/data.js", data);
  return out;
}

// An AI colour proposal (ai.js aiThemes → { vars, fontUrl }) on css/theme.css.
export function applyThemeVars(files, theme) {
  const out = new Map(files);
  const css = out.get("css/theme.css");
  if (css !== undefined && theme?.vars) out.set("css/theme.css", patchTheme(css, { vars: theme.vars, fontUrl: theme.fontUrl }));
  return out;
}

// The template's English placeholder name (labsite/template.json) → the lab's.
export function renameEnglish(files, placeholder, nameEn) {
  const to = String(nameEn || "").trim();
  if (!placeholder || !to) return files;
  const out = new Map(files);
  for (const [path, text] of files) if (/\.(html?|js)$/i.test(path) && text.includes(placeholder)) out.set(path, text.split(placeholder).join(path.endsWith(".js") ? to.replace(/"/g, "'") : esc(to)));
  return out;
}

// Everything the wizard decided, in order.
export function buildWizardSite(files, template, { fill, drop, fields, theme } = {}) {
  let f = fillSlots(files, template.slots, fill);
  f = renameEnglish(f, template.placeholder?.nameEn, fields?.nameEn);
  const allowed = new Set((template.optionalPages || []).map((x) => x.page));
  f = dropPages(f, (drop || []).filter((p) => allowed.has(p)));
  f = fillSiteFields(f, fields);
  return applyThemeVars(f, theme);
}
