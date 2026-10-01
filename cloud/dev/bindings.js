// Node stand-ins for the Cloudflare bindings the workers use. Used by the
// local dev server (no workerd needed) and by the test suite.
//   sqliteD1(path)  D1 on node:sqlite, applying cloud/migrations on first use
//   memoryR2()      R2 in a Map
//   dirR2(dir)      R2 in a folder (one file per key)
import { DatabaseSync } from "node:sqlite";
import { readFileSync, readdirSync, mkdirSync, existsSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const MIGRATIONS = fileURLToPath(new URL("../migrations/", import.meta.url));

export function sqliteD1(path = ":memory:") {
  const db = new DatabaseSync(path);
  db.exec("CREATE TABLE IF NOT EXISTS _migrations (name TEXT PRIMARY KEY)");
  for (const f of readdirSync(MIGRATIONS).filter((f) => f.endsWith(".sql")).sort()) {
    if (db.prepare("SELECT 1 FROM _migrations WHERE name = ?").get(f)) continue;
    db.exec(readFileSync(MIGRATIONS + f, "utf8"));
    db.prepare("INSERT INTO _migrations (name) VALUES (?)").run(f);
  }
  const norm = (row) => (row ? { ...row } : null);
  const stmt = (query, params = []) => ({
    bind: (...p) => stmt(query, p.map((v) => (v === undefined ? null : v))),
    first: async () => norm(db.prepare(query).get(...params)),
    all: async () => ({ results: db.prepare(query).all(...params).map(norm) }),
    run: async () => ({ meta: { changes: Number(db.prepare(query).run(...params).changes) } }),
    runSync: () => ({ meta: { changes: Number(db.prepare(query).run(...params).changes) } }),
  });
  return {
    prepare: (q) => stmt(q),
    async batch(stmts) {
      db.exec("BEGIN");
      try {
        const out = stmts.map((s) => s.runSync());
        db.exec("COMMIT");
        return out;
      } catch (e) {
        db.exec("ROLLBACK");
        throw e;
      }
    },
    raw: db,
  };
}

const r2Object = (bytes) => ({
  body: new Blob([bytes]).stream(),
  arrayBuffer: async () => bytes.slice().buffer,
});

export function memoryR2() {
  const store = new Map();
  return {
    store,
    head: async (key) => (store.has(key) ? { key } : null),
    put: async (key, value) => void store.set(key, new Uint8Array(value)),
    get: async (key) => (store.has(key) ? r2Object(store.get(key)) : null),
  };
}

export function dirR2(dir) {
  mkdirSync(dir, { recursive: true });
  const file = (key) => join(dir, key.replace(/[\\/]/g, "__"));
  return {
    head: async (key) => (existsSync(file(key)) ? { key } : null),
    put: async (key, value) => writeFileSync(file(key), new Uint8Array(value)),
    get: async (key) => (existsSync(file(key)) ? r2Object(new Uint8Array(readFileSync(file(key)))) : null),
  };
}
