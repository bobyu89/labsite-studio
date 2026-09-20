// Minimal IndexedDB wrapper. Drafts (with embedded images) and project
// handles live here instead of localStorage, which caps out around 5 MB.
const NAME = "labsite-studio";
const VERSION = 1;
export const STORES = { drafts: "drafts", projects: "projects" };
let opening = null;

export function openDb() {
  if (typeof indexedDB === "undefined") return Promise.reject(new Error("no-indexeddb"));
  if (!opening)
    opening = new Promise((resolve, reject) => {
      const req = indexedDB.open(NAME, VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        for (const store of Object.values(STORES))
          if (!db.objectStoreNames.contains(store)) db.createObjectStore(store);
      };
      req.onsuccess = () => {
        req.result.onversionchange = () => req.result.close();
        resolve(req.result);
      };
      req.onerror = () => {
        opening = null;
        reject(req.error);
      };
      req.onblocked = () => reject(new Error("blocked"));
    });
  return opening;
}
function run(store, mode, fn) {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(store, mode);
        const req = fn(tx.objectStore(store));
        tx.oncomplete = () => resolve(req && req.result);
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error || new Error("abort"));
      }),
  );
}
export const dbGet = (store, key) => run(store, "readonly", (s) => s.get(key));
export const dbPut = (store, key, value) => run(store, "readwrite", (s) => s.put(value, key));
export const dbDelete = (store, key) => run(store, "readwrite", (s) => s.delete(key));
export const dbKeys = (store) => run(store, "readonly", (s) => s.getAllKeys());
