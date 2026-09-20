// Reads and patches the string fields of `const SITE = { ... }` in js/data.js
// without evaluating the file. Only double-quoted, single-line values are
// exposed; numbers and nested objects stay untouched.

export const SITE_LABELS = {
  nameZh: "研究室名稱",
  nameEn: "英文名稱",
  tagline: "標語",
  taglineEn: "英文標語",
  pi: "主持人",
  piEn: "主持人（英文）",
  dept: "系所單位",
  deptEn: "系所單位（英文）",
  email: "聯絡 Email",
  phone: "電話",
  scholar: "Google Scholar 網址",
};

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
