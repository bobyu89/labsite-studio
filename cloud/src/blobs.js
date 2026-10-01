// Where file contents live, by content hash. R2 when the BLOBS binding exists,
// otherwise D1 (base64 chunks), so the whole system can run on D1 alone.
import { toBase64, fromBase64 } from "./bytes.js";

const MiB = 1024 * 1024;

function r2Store(bucket) {
  const key = (hash) => "b/" + hash;
  return {
    kind: "r2",
    has: async (hash) => !!(await bucket.head(key(hash))),
    put: (hash, bytes) => bucket.put(key(hash), bytes),
    async get(hash) {
      const obj = await bucket.get(key(hash));
      return obj ? new Uint8Array(await obj.arrayBuffer()) : null;
    },
    async stream(hash) {
      const obj = await bucket.get(key(hash));
      return obj ? obj.body : null;
    },
  };
}

function d1Store(db, chunkBytes) {
  const store = {
    kind: "d1",
    has: async (hash) => !!(await db.prepare("SELECT 1 AS ok FROM blobs WHERE hash = ?").bind(hash).first()),
    async put(hash, bytes) {
      const chunks = Math.max(1, Math.ceil(bytes.length / chunkBytes));
      // One statement per chunk keeps every request well under D1's size limits.
      for (let i = 0; i < chunks; i++)
        await db
          .prepare("INSERT OR IGNORE INTO blob_chunks (hash, idx, data) VALUES (?, ?, ?)")
          .bind(hash, i, toBase64(bytes.subarray(i * chunkBytes, (i + 1) * chunkBytes)))
          .run();
      await db.prepare("INSERT OR IGNORE INTO blobs (hash, size, chunks) VALUES (?, ?, ?)").bind(hash, bytes.length, chunks).run();
    },
    async get(hash) {
      const meta = await db.prepare("SELECT size, chunks FROM blobs WHERE hash = ?").bind(hash).first();
      if (!meta) return null;
      const out = new Uint8Array(meta.size);
      let at = 0;
      for (let i = 0; i < meta.chunks; i++) {
        const row = await db.prepare("SELECT data FROM blob_chunks WHERE hash = ? AND idx = ?").bind(hash, i).first();
        if (!row) return null;
        const part = fromBase64(row.data);
        out.set(part, at);
        at += part.length;
      }
      return at === meta.size ? out : null;
    },
    async stream(hash) {
      const bytes = await store.get(hash);
      return bytes ? new Blob([bytes]).stream() : null;
    },
  };
  return store;
}

export function blobStore(env) {
  if (env.BLOBS) return r2Store(env.BLOBS);
  return d1Store(env.DB, Number(env.BLOB_CHUNK_BYTES) || MiB);
}
