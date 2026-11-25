// 中英不同步: which sections changed in one language since the last publish
// while the same section in the other language did not. The published
// version is the shared starting point, so nothing extra is stored in the
// pages; once both languages are published the reminder goes away.
import { parsePage, sectionElements, collectFields, listSections, structureSignature } from "./page.js";

const collapse = (s) => String(s ?? "").replace(/\s+/g, " ").trim();

// html → { signature, texts: [one string per section], titles }
export function sectionTexts(html) {
  const doc = parsePage(html).doc;
  const sections = sectionElements(doc);
  const fields = sections.map((s) =>
    collectFields(s)
      .filter((f) => f.kind === "text")
      .map((f) => collapse(f.value))
      .filter(Boolean),
  );
  return {
    signature: structureSignature(doc),
    fields,
    texts: fields.map((f) => f.join("\n")),
    titles: listSections(doc).map((s) => s.title),
  };
}

// FNV-1a, enough to tell one wording from another (for 不用改).
export function textHash(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

// zh/en now and as published (html strings; a missing published version
// means the page is new and is skipped) →
// [{ section, title, behind: "en" | "zh", reason, hash }]:
// - reason "changed": one language changed since publishing, the other not.
// - reason "untranslated": new Chinese text on the English page (items
//   copied over by 同步 keep the original wording until translated).
// section is an index on both pages while they line up; null when they no
// longer do, so only the whole page can be compared.
const CJK = /[㐀-鿿]/;
export function outOfSync({ zhNow, zhBase, enNow, enBase }) {
  if (!zhNow || !enNow || !zhBase || !enBase) return [];
  const zn = sectionTexts(zhNow);
  const zb = sectionTexts(zhBase);
  const en = sectionTexts(enNow);
  const eb = sectionTexts(enBase);
  const pairNow = zn.signature === en.signature;
  const out = [];
  if (pairNow && zn.signature === zb.signature && en.signature === eb.signature) {
    zn.texts.forEach((t, i) => {
      const zChanged = t !== zb.texts[i];
      const eChanged = en.texts[i] !== eb.texts[i];
      if (zChanged === eChanged) return;
      out.push({ section: i, title: zn.titles[i], behind: zChanged ? "en" : "zh", reason: "changed", hash: textHash(zChanged ? t : en.texts[i]) });
    });
  } else {
    const zChanged = zn.texts.join("\n") !== zb.texts.join("\n");
    const eChanged = en.texts.join("\n") !== eb.texts.join("\n");
    if (zChanged !== eChanged)
      out.push({ section: null, title: null, behind: zChanged ? "en" : "zh", reason: "changed", hash: textHash(zChanged ? zn.texts.join("\n") : en.texts.join("\n")) });
  }
  const before = new Set(eb.fields.flat());
  en.fields.forEach((values, i) => {
    const fresh = values.filter((v) => CJK.test(v) && !before.has(v));
    if (!fresh.length) return;
    const at = pairNow ? i : null;
    if (out.some((x) => x.section === at && x.behind === "en")) return;
    out.push({ section: at, title: en.titles[i], behind: "en", reason: "untranslated", hash: textHash(fresh.join("\n")) });
  });
  return out;
}
