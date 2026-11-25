// 學期更新精靈: the member lists on the members page, and the changes a new
// semester brings — graduates move to the 畢業成員 list (or leave the
// list), years go up by one (碩一 → 碩二, 1st-year → 2nd-year), and new
// members are added. Pure DOM work; MembersWizard.jsx is the dialog.
import { sectionElements, describeNode, nodeAt, collectFields, setText, addItemAtTop, addItem, removeItem } from "./page.js";

const collapse = (s) => String(s ?? "").replace(/\s+/g, " ").trim();
const ALUMNI = /畢業|校友|歷屆|alumni|graduat|former/i;

// doc → { current: [{ section, path, heading, items: [{ index, name, role, nameField, roleField }] }],
//          alumni: { section, path, heading, fields } | null }
export function memberLists(doc) {
  const current = [];
  let alumni = null;
  sectionElements(doc).forEach((section, si) => {
    for (const list of describeNode(section).lists) {
      if (list.label !== "成員" && list.label !== "畢業成員") continue;
      const container = nodeAt(section, list.path);
      const heading = collapse(container.closest("section")?.querySelector("h2, h3")?.textContent || "");
      if (list.label === "畢業成員" || ALUMNI.test(heading)) {
        if (!alumni) {
          const first = container.children[0];
          alumni = { section: si, path: list.path, heading, fields: collectFields(first, first).filter((f) => f.kind === "text").map((f) => collapse(f.value)) };
        }
        continue;
      }
      const items = [...container.children].map((item, index) => {
        const texts = collectFields(item, section).filter((f) => f.kind === "text" && collapse(f.value));
        return { index, name: collapse(texts[0]?.value), role: collapse(texts[1]?.value), nameField: texts[0]?.path || null, roleField: texts[1]?.path || null };
      });
      if (items.some((x) => x.name)) current.push({ section: si, path: list.path, heading, items });
    }
  });
  return { current, alumni };
}

const ZH_NUM = "一二三四五六七";
// "碩一" → "碩二", "博士班二年級" → "博士班三年級", "1st-year PhD" →
// "2nd-year PhD", "Year 2" → "Year 3"; null when there is no year to raise.
export function bumpYear(role) {
  const r = String(role || "");
  let m = r.match(/([碩博大])([一二三四五六])(?![年級])/);
  if (m && ZH_NUM.indexOf(m[2]) < 6) return r.replace(m[0], m[1] + ZH_NUM[ZH_NUM.indexOf(m[2]) + 1]);
  m = r.match(/([一二三四五六])年級/);
  if (m) return r.replace(m[0], ZH_NUM[ZH_NUM.indexOf(m[1]) + 1] + "年級");
  m = r.match(/\b(\d)(st|nd|rd|th)[-\s]year\b/i);
  if (m) {
    const n = Number(m[1]) + 1;
    const suffix = n === 2 ? "nd" : n === 3 ? "rd" : "th";
    return r.replace(m[0], `${n}${suffix}${m[0].slice(m[1].length + m[2].length)}`);
  }
  m = r.match(/\bYear (\d)\b/);
  if (m) return r.replace(m[0], "Year " + (Number(m[1]) + 1));
  return null;
}

export function degreeOf(role) {
  const r = String(role || "");
  if (/博士|PhD|Ph\.D|doctoral/i.test(r)) return "博士";
  if (/碩|master|MSN/i.test(r)) return "碩士";
  if (/大學部|學士|大[一二三四]|undergrad/i.test(r)) return "學士";
  return "";
}

// plan: { graduates: [{ list, index, values }], roles: [{ list, index, value }], add: [{ list, name, role }] }
// (list: an index into memberLists(doc).current). Returns true when the page changed.
export function applySemester(doc, plan) {
  const { current, alumni } = memberLists(doc);
  const sections = sectionElements(doc);
  let changed = false;
  // 1. New wording of roles (before any item moves).
  for (const r of plan.roles || []) {
    const list = current[r.list];
    const item = list?.items[r.index];
    if (item?.roleField && r.value && r.value !== item.role) changed = setText(sections[list.section], item.roleField, r.value) || changed;
  }
  // 2. Graduates to the top of 畢業成員, newest first.
  if (alumni)
    for (const g of [...(plan.graduates || [])].reverse())
      changed =
        addItemAtTop(sections[alumni.section], alumni.path, (copy) => {
          const fields = collectFields(copy, copy).filter((f) => f.kind === "text");
          fields.forEach((f, i) => setText(copy, f.path, collapse(g.values[i] ?? "")));
        }) || changed;
  // 3. New members after the last one, from a copy with the other words emptied.
  for (const a of plan.add || []) {
    const list = current[a.list];
    if (!list) continue;
    const section = sections[list.section];
    if (!addItem(section, list.path)) continue;
    const container = nodeAt(section, list.path);
    const added = container.children[container.children.length - 1];
    const fields = collectFields(added, added).filter((f) => f.kind === "text" && collapse(f.value));
    fields.forEach((f, i) => setText(added, f.path, i === 0 ? a.name : i === 1 ? a.role || "" : ""));
    changed = true;
  }
  // 4. Graduates leave the list, last first so the other places hold.
  const byList = new Map();
  for (const g of plan.graduates || []) byList.set(g.list, [...(byList.get(g.list) || []), g.index]);
  for (const [li, indexes] of byList) {
    const list = current[li];
    for (const index of indexes.sort((a, b) => b - a)) changed = removeItem(sections[list.section], list.path, index) || changed;
  }
  return changed;
}

// "王小明、碩士班研究生" / "Wang Xiao-Ming, PhD student" per line → [{ name, role }]
export function parseNewMembers(text) {
  return String(text || "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const [name, ...rest] = l.split(/\s*[、，,\t｜|]\s*/);
      return { name: collapse(name), role: collapse(rest.join("、")) };
    })
    .filter((x) => x.name);
}
