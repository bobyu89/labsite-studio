// 研究室檔案 (LAB.md): who this lab is, in the lab's own words, so every AI
// request writes for this lab and not a generic one. Asked by the site
// wizard, editable later (LabProfile.jsx); stored per site in the platform
// settings as `lab:<siteId>`. The design standard (design.js) is the same
// for every lab; this is what makes the words this lab's.

export const PROFILE_FIELDS = [
  { key: "oneLine", label: "一句話介紹", hint: "我們研究［誰］的［什麼問題］，用［什麼方法］，讓［什麼改變］。", max: 120 },
  { key: "audience", label: "主要訪客", hint: "例如：想報考碩士班的學生、社區據點夥伴、合作醫院", max: 120 },
  { key: "impression", label: "想給人的印象", hint: "例如：親切、真的在社區裡、做得到", max: 60 },
  { key: "tone", label: "語氣", hint: "例如：口語、短句、用「我們」；專有名詞後面加白話", max: 120 },
  { key: "mustUse", label: "一定要用的詞", hint: "例如：家庭照顧者（不用「看護」）、失智長輩（不用「失智老人」）", max: 300 },
  { key: "avoid", label: "不要出現", hint: "例如：病人正臉照片、驚嘆號", max: 300 },
  { key: "glossary", label: "英文固定譯法", hint: "例如：喘息服務 = respite care；據點 = community care station", max: 400 },
];

const clip = (v, n) => String(v ?? "").replace(/\u0000/g, "").replace(/\s+\n/g, "\n").trim().slice(0, n);

// Anything in → a clean profile (unknown keys dropped, lengths capped).
export function cleanProfile(raw) {
  const src = raw && typeof raw === "object" ? raw : {};
  const out = {};
  for (const f of PROFILE_FIELDS) {
    const v = clip(src[f.key], f.max);
    if (v) out[f.key] = v;
  }
  if (src.pack && /^[a-z]{2,20}$/.test(String(src.pack))) out.pack = String(src.pack);
  return out;
}

export const isEmptyProfile = (profile) => !PROFILE_FIELDS.some((f) => profile?.[f.key]);

// The profile as the AI reads it (and as a person would write LAB.md).
export function profileText(profile, { name, nameEn, packName } = {}) {
  const p = cleanProfile(profile);
  if (isEmptyProfile(p) && !name) return "";
  const lines = ["## 研究室檔案（LAB.md）— this lab's own words; they take precedence over the general defaults"];
  if (name) lines.push(`研究室：${clip(name, 80)}${nameEn ? " " + clip(nameEn, 120) : ""}`);
  if (packName) lines.push(`風格包：${packName}`);
  for (const f of PROFILE_FIELDS) if (p[f.key]) lines.push(`${f.label}：${p[f.key]}`);
  return lines.join("\n");
}

// The wizard's answers → a first profile (the teacher can edit it there).
export function profileFromWizard(a = {}, plan = {}) {
  return cleanProfile({
    oneLine: a.oneLine || plan.one_line || "",
    audience: (a.audience || []).join("、"),
    impression: a.mood || a.impression || "",
    tone: a.tone || "",
    mustUse: a.mustUse || "",
    avoid: a.avoid || "",
    pack: a.pack || "",
  });
}
