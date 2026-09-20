import { normalizeDocument } from "./project.js";
import { KEY } from "../model.js";
import { dbGet, dbPut, STORES } from "./db.js";

// Validates a raw saved record (from any storage) and migrates every snapshot.
// Pure: never writes back. Returns { record, migrated, error }.
export function parseSavedRecord(r) {
  try {
    if (
      !r ||
      !Number.isInteger(r.revision) ||
      r.revision < 1 ||
      !Array.isArray(r.history) ||
      r.history.length > 15 ||
      typeof r.savedAt !== "string"
    )
      throw Error();
    const draft = normalizeDocument(r.draft);
    const history = r.history.map((h) => {
      if (
        !Number.isInteger(h.revision) ||
        h.revision < 1 ||
        typeof h.savedAt !== "string"
      )
        throw Error();
      return {
        revision: h.revision,
        savedAt: h.savedAt,
        draft: normalizeDocument(h.draft),
      };
    });
    return {
      record: { revision: r.revision, savedAt: r.savedAt, draft, history },
      migrated: r.draft.schemaVersion !== 2,
      error: null,
    };
  } catch {
    return {
      record: null,
      migrated: false,
      error:
        "無法讀取本機草稿。原始資料未被覆寫，請保留資料並檢查備份格式或瀏覽器儲存權限。",
    };
  }
}
// Legacy localStorage record (v1/v2 releases). Kept read-only for recovery.
export function readSavedRecord(storage = localStorage) {
  try {
    const raw = storage.getItem(KEY);
    if (!raw) return { record: null, error: null, migrated: false };
    return parseSavedRecord(JSON.parse(raw));
  } catch {
    return parseSavedRecord(null);
  }
}
// IndexedDB is the primary store; an old localStorage record is imported once
// when IndexedDB has nothing yet, and left in place.
export async function loadRecord() {
  let raw;
  try {
    raw = await dbGet(STORES.drafts, KEY);
  } catch {
    return {
      record: null,
      migrated: false,
      error: "此瀏覽器無法使用本機資料庫，草稿只會保留在畫面中，請定期下載備份。",
    };
  }
  if (raw) return parseSavedRecord(raw);
  const legacy = typeof localStorage === "undefined" ? { record: null, error: null } : readSavedRecord();
  if (legacy.record)
    return { ...legacy, migrated: true, imported: true };
  return legacy;
}
export async function storeRecord(record) {
  await dbPut(STORES.drafts, KEY, record);
}
