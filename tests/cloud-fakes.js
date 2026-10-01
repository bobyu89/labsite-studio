// In-process stand-ins for the Cloudflare bindings, so the cloud worker's real
// code runs under `node --test`:
//   D1    → node:sqlite running the real migration files
//   R2    → a Map with head/get/put
//   fetch → scripted replies (GitHub API, Access certs)
import { sqliteD1, memoryR2 } from "../cloud/dev/bindings.js";

export const fakeD1 = () => sqliteD1(":memory:");
export const fakeR2 = () => memoryR2();

export function fakeEnv(extra = {}) {
  return {
    DB: fakeD1(),
    BLOBS: fakeR2(),
    ADMIN_EMAILS: "admin@lab.tw",
    SITE_URL_TEMPLATE: "https://sites.example/{slug}/",
    DEV_AUTH: "on",
    DEV_USER_EMAIL: "admin@lab.tw",
    ...extra,
  };
}

// routes: [[string|RegExp, reply | (url, init) => reply]], reply = { status, json, body, headers }
export function scriptedFetch(routes) {
  const calls = [];
  const fn = async (url, init = {}) => {
    const u = String(url);
    calls.push({ url: u, method: init.method || "GET", body: init.body, headers: init.headers || {} });
    for (const [match, reply] of routes) {
      if (typeof match === "string" ? u.includes(match) : match.test(u)) {
        const r = typeof reply === "function" ? await reply(u, init) : reply;
        const status = r.status || 200;
        if (r.body !== undefined) return new Response(r.body, { status, headers: r.headers });
        return new Response(JSON.stringify(r.json ?? {}), { status, headers: { "Content-Type": "application/json" } });
      }
    }
    return new Response(JSON.stringify({ message: "no route: " + u }), { status: 404 });
  };
  fn.calls = calls;
  return fn;
}

// A tiny tar writer for tests (ustar, with a pax header for long names).
export function makeTar(entries) {
  const enc = new TextEncoder();
  const blocks = [];
  const header = (name, size, type) => {
    const h = new Uint8Array(512);
    const put = (s, off, len) => h.set(enc.encode(s).subarray(0, len), off);
    put(name, 0, 100);
    put("0000644\0", 100, 8);
    put("0000000\0", 108, 8);
    put("0000000\0", 116, 8);
    put(size.toString(8).padStart(11, "0") + "\0", 124, 12);
    put("00000000000\0", 136, 12);
    put("        ", 148, 8);
    h[156] = type.charCodeAt(0);
    put("ustar\0", 257, 6);
    put("00", 263, 2);
    let sum = 0;
    for (const b of h) sum += b;
    put(sum.toString(8).padStart(6, "0") + "\0 ", 148, 8);
    return h;
  };
  const pad = (data) => {
    const out = new Uint8Array(Math.ceil(data.length / 512) * 512);
    out.set(data);
    return out;
  };
  for (const e of entries) {
    const data = typeof e.data === "string" ? enc.encode(e.data) : e.data;
    if (e.type === "g" || e.type === "x") {
      blocks.push(header(e.path, data.length, e.type), pad(data));
      continue;
    }
    if (e.type === "5") {
      blocks.push(header(e.path, 0, "5"));
      continue;
    }
    if (enc.encode(e.path).length > 100) {
      // pax record "<len> path=<path>\n", where <len> counts bytes, itself included
      const rec = enc.encode(` path=${e.path}\n`).length;
      let len = rec + 2;
      while (String(len).length + rec !== len) len = String(len).length + rec;
      const pax = enc.encode(len + ` path=${e.path}\n`);
      blocks.push(header("PaxHeader", pax.length, "x"), pad(pax));
    }
    blocks.push(header(e.path.slice(0, 100), data.length, "0"), pad(data));
  }
  blocks.push(new Uint8Array(1024));
  const out = new Uint8Array(blocks.reduce((n, b) => n + b.length, 0));
  let at = 0;
  for (const b of blocks) {
    out.set(b, at);
    at += b.length;
  }
  return out;
}

export async function gzip(bytes) {
  const s = new Blob([bytes]).stream().pipeThrough(new CompressionStream("gzip"));
  return new Uint8Array(await new Response(s).arrayBuffer());
}
