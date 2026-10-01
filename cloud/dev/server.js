// Local LabSite Cloud without workerd: runs the real worker code on Node.
//   http://127.0.0.1:8787  editor (../dist) + /api   — signed in as DEV_USER_EMAIL
//   http://127.0.0.1:8788  public sites (published versions)
// Data lives in cloud/.wrangler/node-dev/ (SQLite file + blob folder).
//
//   npm run build            (in labsite-studio/, to refresh ../dist)
//   npm --prefix cloud run dev:node
import { createServer } from "node:http";
import { readFileSync, existsSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, normalize } from "node:path";
import { sqliteD1, dirR2 } from "./bindings.js";
import { createApp } from "../src/api.js";
import { serve } from "../src/sites.js";
import { contentType } from "../src/mime.js";

const here = fileURLToPath(new URL(".", import.meta.url));
const state = join(here, "../.wrangler/node-dev");
mkdirSync(state, { recursive: true });
const dist = join(here, "../../dist");

function devVars() {
  const file = join(here, "../.dev.vars");
  if (!existsSync(file)) return {};
  return Object.fromEntries(
    readFileSync(file, "utf8")
      .split(/\r?\n/)
      .filter((l) => /^\w+=/.test(l))
      .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
  );
}

const ASSETS = {
  async fetch(request) {
    const url = new URL(request.url);
    let path = normalize(decodeURIComponent(url.pathname)).replace(/^[\\/]+/, "");
    if (!path || path.endsWith("/") || path.endsWith("\\")) path += "index.html";
    let file = join(dist, path);
    if (!file.startsWith(dist) || !existsSync(file)) file = join(dist, "index.html"); // SPA fallback
    if (!existsSync(file)) return new Response("先執行 npm run build 產生 dist/", { status: 500 });
    return new Response(readFileSync(file), { headers: { "Content-Type": contentType(file) } });
  },
};

const env = {
  ADMIN_EMAILS: "bobyu89@gmail.com",
  SITE_URL_TEMPLATE: "http://127.0.0.1:8788/{slug}/",
  DEV_AUTH: "on",
  DEV_USER_EMAIL: "bobyu89@gmail.com",
  ...devVars(),
  DB: sqliteD1(join(state, "labsite.sqlite")),
  BLOBS: dirR2(join(state, "blobs")),
  ASSETS,
};
const app = createApp();

function listen(port, handler) {
  createServer(async (req, res) => {
    try {
      const chunks = [];
      for await (const c of req) chunks.push(c);
      const body = chunks.length ? Buffer.concat(chunks) : undefined;
      const request = new Request(`http://${req.headers.host}${req.url}`, {
        method: req.method,
        headers: Object.entries(req.headers).filter(([, v]) => typeof v === "string"),
        body: req.method === "GET" || req.method === "HEAD" ? undefined : body,
      });
      const response = await handler(request);
      res.writeHead(response.status, Object.fromEntries(response.headers));
      if (response.body) for await (const c of response.body) res.write(c);
      res.end();
    } catch (e) {
      console.error(e);
      res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
      res.end(String(e.stack || e));
    }
  }).listen(port, "127.0.0.1", () => console.log(`[labsite-cloud] http://127.0.0.1:${port}`));
}

listen(8787, (request) => app.fetch(request, env));
listen(8788, (request) => serve(request, env));
console.log(`[labsite-cloud] signed in as ${env.DEV_USER_EMAIL}; data in ${state}`);
