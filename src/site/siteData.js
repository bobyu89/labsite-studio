// Reads and patches the string fields of `const SITE = { ... }` in js/data.js
// without evaluating the file. Only double-quoted, single-line values are
// exposed; numbers and nested objects stay untouched.

// What each field is and where it shows on the site, so a teacher knows what
// they are changing. Fields the current layouts do not show are marked unused.
export const SITE_FIELDS = {
  nameZh: { label: "研究室中文名稱", where: "每一頁左上角、頁尾與版權。", group: "name" },
  nameEn: { label: "研究室英文名稱", where: "中文頁左上角名稱下方的小字；英文頁的左上角與頁尾。", group: "name" },
  dept: { label: "系所單位", where: "頁尾，研究室名稱下方。", group: "contact" },
  deptEn: { label: "系所單位（英文）", where: "英文頁的頁尾。", group: "contact" },
  address: { label: "地址", where: "頁尾。", group: "contact", long: true },
  addressEn: { label: "地址（英文）", where: "英文頁的頁尾。", group: "contact", long: true },
  email: { label: "聯絡 Email", where: "頁尾，訪客點一下就能寄信。", group: "contact", type: "email" },
  phone: { label: "電話", where: "頁尾。", group: "contact" },
  tagline: {
    label: "一句話介紹",
    where: "目前版面沒有顯示這一行；首頁的介紹文字請在首頁主視覺直接點選修改。",
    group: "other",
    unused: true,
    long: true,
  },
  taglineEn: {
    label: "一句話介紹（英文）",
    where: "目前版面沒有顯示這一行；英文首頁的介紹請在英文首頁直接修改。",
    group: "other",
    unused: true,
    long: true,
  },
  pi: { label: "主持人", group: "other" },
  piEn: { label: "主持人（英文）", group: "other" },
  scholar: { label: "Google Scholar 網址", group: "other", type: "url" },
};
export const SITE_LABELS = Object.fromEntries(Object.entries(SITE_FIELDS).map(([k, v]) => [k, v.label]));
export const SITE_GROUPS = [
  ["name", "研究室名稱"],
  ["contact", "單位與聯絡方式"],
  ["other", "其他"],
];

// Template placeholder values ("範例", example.edu, the demo lab's name).
const SAMPLE = /範例|sample|example\.(?:edu|com|org)|0000-0000|Zhixing/i;
export const isSampleValue = (v) => SAMPLE.test(String(v || ""));

const BLOCK = /const\s+SITE\s*=\s*\{/;
const ENTRY = /^(\s*)([A-Za-z_$][\w$]*)\s*:\s*"((?:[^"\\\n]|\\.)*)"/;

function blockRange(text) {
  const start = text.search(BLOCK);
  if (start < 0) return null;
  const open = text.indexOf("{", start);
  let depth = 0;
  for (let i = open; i < text.length; i++) {
    const ch = text[i];
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) return { start: open, end: i };
    }
  }
  return null;
}

export function readSiteFields(text) {
  const range = blockRange(text);
  if (!range) return { ok: false, fields: [] };
  const fields = [];
  let offset = range.start;
  for (const line of text.slice(range.start, range.end).split("\n")) {
    const m = line.match(ENTRY);
    if (m) {
      const valueStart = offset + m[0].length - m[3].length - 1;
      fields.push({
        key: m[2],
        label: SITE_LABELS[m[2]] || m[2],
        ...(SITE_FIELDS[m[2]]
          ? { where: SITE_FIELDS[m[2]].where, group: SITE_FIELDS[m[2]].group, unused: !!SITE_FIELDS[m[2]].unused }
          : { group: "other" }),
        value: unescape(m[3]),
        start: valueStart,
        end: valueStart + m[3].length,
      });
    }
    offset += line.length + 1;
  }
  return { ok: true, fields };
}
const unescape = (s) =>
  s.replace(/\\(["\\nt])/g, (_, c) => ({ '"': '"', "\\": "\\", n: "\n", t: "\t" })[c]);
const escape = (s) =>
  s.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\r?\n/g, "\\n");

export function patchSiteField(text, key, value) {
  const field = readSiteFields(text).fields.find((f) => f.key === key);
  if (!field) throw new Error("找不到 SITE." + key);
  return text.slice(0, field.start) + escape(value) + text.slice(field.end);
}
