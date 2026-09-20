import {
  migrateLegacy,
  normalizeDocument,
  homepage,
} from "./domain/project.js";
import { legacySeed } from "./domain/seed.js";
export const KEY = "labsite-studio-v1";
export const seed = normalizeDocument(migrateLegacy(legacySeed));
export const clone = (x) => structuredClone(x);
export function validate(d) {
  const errors = [];
  if (!d.name.trim()) errors.push("全站設定：請填寫網站名稱");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email))
    errors.push("聯絡資訊：Email 格式不正確");
  for (const p of d.pages) {
    if (!p.blocks.some((b) => b.visible))
      errors.push(`${p.name}：至少需要一個顯示的區塊`);
    for (const b of p.blocks.filter((b) => b.visible)) {
      if (b.type === "hero") {
        if (!b.props.title.trim())
          errors.push(`${p.name}／${b.title}：請填寫標題`);
        if (!b.props.description.trim())
          errors.push(`${p.name}／${b.title}：請填寫介紹`);
      } else if (d.collections[b.collectionId].some((x) => !x.title.trim()))
        errors.push(`${b.title}：項目標題不可留白`);
      if (b.type === "news" && d.collections.news.some((x) => !x.date))
        errors.push(`${b.title}：請填寫消息日期`);
    }
  }
  if (d.assets.some((a) => !a.alt.trim()))
    errors.push("素材庫：請補上每張圖片的替代文字");
  return [...new Set(errors)];
}
export function nextRecord(current, expected, draft) {
  if ((current?.revision ?? 0) !== expected) throw Error("conflict");
  const revision = expected + 1,
    savedAt = new Date().toISOString();
  return {
    revision,
    savedAt,
    draft: normalizeDocument(draft),
    history: [
      { revision, savedAt, draft: normalizeDocument(draft) },
      ...(current?.history ?? []),
    ].slice(0, 15),
  };
}
export function moveBlock(draft, id, direction) {
  const d = clone(draft);
  const blocks = homepage(d).blocks;
  const i = blocks.findIndex((b) => b.id === id),
    j = i + direction;
  if (i < 0 || j < 0 || j >= blocks.length) return d;
  [blocks[i], blocks[j]] = [blocks[j], blocks[i]];
  return d;
}
